import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { MFAChallenge } from "@/components/auth/MFAChallenge";
import { EmailMFAChallenge } from "@/components/auth/EmailMFAChallenge";
import { BiometricLogin } from "@/components/auth/BiometricLogin";
import pulseLogo from "@/assets/pulse-logo-new.png";

const authSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password too long"),
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name too long").optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name too long").optional(),
  state: z.enum(["Massachusetts", "Rhode Island"], {
    errorMap: () => ({ message: "Please select your state" }),
  }).optional(),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/dashboard';
  
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedState, setSelectedState] = useState<"Massachusetts" | "Rhode Island" | "">("");
  const [showMFAChallenge, setShowMFAChallenge] = useState(false);
  const [showEmailMFA, setShowEmailMFA] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "email" | "none">("none");
  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(() => {
    // Check localStorage for persisted preference (default to true)
    const saved = localStorage.getItem('pulse_persist_session');
    return saved === null ? true : saved === 'true';
  });
  const [tosAccepted, setTosAccepted] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate based on mode
      const validationData = isLogin 
        ? { email, password }
        : { email, password, firstName, lastName, state: selectedState };
      
      const validationResult = authSchema.safeParse(validationData);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setLoading(false);
        return;
      }

      if (!isLogin) {
        // Signup validations
        if (email !== confirmEmail) {
          toast.error("Email addresses must match");
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          toast.error("Passwords must match");
          setLoading(false);
          return;
        }

        if (!selectedState) {
          toast.error("Please select your state");
          setLoading(false);
          return;
        }

        if (!tosAccepted) {
          toast.error("Please accept the Terms of Service and Privacy Policy");
          setLoading(false);
          return;
        }
      }

      // Save "stay signed in" preference
      localStorage.setItem('pulse_persist_session', staySignedIn.toString());

      if (isLogin) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        // Check if MFA is enabled for this user
        const { data: profile } = await supabase
          .from('profiles')
          .select('mfa_method')
          .eq('id', authData.user?.id)
          .maybeSingle();

        if (profile?.mfa_method === 'authenticator') {
          // Need to complete MFA challenge
          setShowMFAChallenge(true);
          setMfaMethod('authenticator');
          return;
        } else if (profile?.mfa_method === 'email') {
          setShowEmailMFA(true);
          setMfaMethod('email');
          return;
        }

        toast.success("Logged in successfully!");
        navigate(redirectPath);
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim(),
              state: selectedState,
            }
          }
        });

        if (authError) throw authError;

        if (authData.user) {
          toast.success("Account created! Welcome to PULSE!");
          navigate(redirectPath);
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const emailValidation = z.string().email("Invalid email address").safeParse(email);
      
      if (!emailValidation.success) {
        toast.error("Please enter a valid email address");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success("Password reset email sent! Check your inbox.");
      setIsForgotPassword(false);
      setEmail("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMFASuccess = () => {
    setShowMFAChallenge(false);
    setShowEmailMFA(false);
    toast.success("Logged in successfully!");
    setTimeout(() => {
      navigate(redirectPath);
    }, 100);
  };

  const handleMFACancel = async () => {
    setShowMFAChallenge(false);
    setShowEmailMFA(false);
    await supabase.auth.signOut();
    toast.info("Login cancelled");
  };

  const handleBiometricSuccess = () => {
    toast.success("Logged in successfully!");
    navigate(redirectPath);
  };

  const checkBiometricAvailability = async () => {
    if (!email || !isLogin) {
      setShowBiometric(false);
      setBiometricAvailable(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('biometric_enabled')
        .eq('email', email)
        .maybeSingle();

      const hasBiometric = profile?.biometric_enabled || false;
      const isSupported = window.PublicKeyCredential !== undefined;
      
      setBiometricAvailable(hasBiometric && isSupported);
      setShowBiometric(hasBiometric && isSupported && !showPasswordLogin);
    } catch (error) {
      console.error('Error checking biometric:', error);
      setBiometricAvailable(false);
      setShowBiometric(false);
    }
  };

  useEffect(() => {
    if (isLogin && email && email.includes('@')) {
      const debounce = setTimeout(() => {
        checkBiometricAvailability();
      }, 500);
      return () => clearTimeout(debounce);
    } else {
      setShowBiometric(false);
      setBiometricAvailable(false);
    }
  }, [email, isLogin, showPasswordLogin]);

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center bg-secondary p-4 pt-8 md:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-4 md:mb-8">
          <Link to="/">
            <img 
              src={pulseLogo} 
              alt="PULSE" 
              className="h-48 md:h-60 w-auto mx-auto cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isForgotPassword ? "Reset Password" : isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {isForgotPassword
                ? "Enter your email to receive a password reset link"
                : isLogin
                ? "Sign in to track your pickleball matches"
                : "Join PULSE to start tracking your rating"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isForgotPassword ? (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>

                <div className="text-center text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setEmail("");
                    }}
                    className="text-primary hover:underline"
                  >
                    Back to sign in
                  </button>
                </div>
              </form>
            ) : showBiometric && isLogin ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setShowPasswordLogin(false);
                    }}
                    placeholder="your@email.com"
                  />
                </div>

                <BiometricLogin
                  email={email}
                  onSuccess={handleBiometricSuccess}
                  onFallback={() => setShowPasswordLogin(true)}
                />
              </div>
            ) : (
              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          placeholder="First name"
                          disabled={loading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          placeholder="Last name"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Select 
                        value={selectedState} 
                        onValueChange={(value) => setSelectedState(value as "Massachusetts" | "Rhode Island")}
                        disabled={loading}
                      >
                        <SelectTrigger id="state">
                          <SelectValue placeholder="Select your state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Massachusetts">Massachusetts</SelectItem>
                          <SelectItem value="Rhode Island">Rhode Island</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (!isLogin) {
                        setShowPasswordLogin(false);
                      }
                    }}
                    required
                    placeholder="your@email.com"
                    disabled={loading}
                  />
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmEmail">Confirm Email</Label>
                    <Input
                      id="confirmEmail"
                      type="email"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      className={confirmEmail && email !== confirmEmail ? "border-red-500" : ""}
                      disabled={loading}
                    />
                    {confirmEmail && email !== confirmEmail && (
                      <p className="text-xs text-red-500">Email addresses must match</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    disabled={loading}
                  />
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength={6}
                      className={confirmPassword && password !== confirmPassword ? "border-red-500" : ""}
                      disabled={loading}
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-500">Passwords must match</p>
                    )}
                  </div>
                )}

                {!isLogin && (
                  <div className="flex items-start space-x-2 pt-2">
                    <Checkbox 
                      id="tosAccepted" 
                      checked={tosAccepted}
                      onCheckedChange={(checked) => setTosAccepted(checked as boolean)}
                      disabled={loading}
                      className="mt-0.5"
                    />
                    <Label 
                      htmlFor="tosAccepted" 
                      className="text-sm font-normal leading-relaxed cursor-pointer"
                    >
                      I agree to the{" "}
                      <a 
                        href="/changelog?tab=legal&section=terms" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms of Service
                      </a>
                      {" "}and{" "}
                      <a 
                        href="/changelog?tab=legal&section=privacy" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </a>
                    </Label>
                  </div>
                )}

                {isLogin && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="staySignedIn" 
                        checked={staySignedIn}
                        onCheckedChange={(checked) => setStaySignedIn(checked as boolean)}
                      />
                      <Label 
                        htmlFor="staySignedIn" 
                        className="text-sm font-normal cursor-pointer"
                      >
                        Stay signed in
                      </Label>
                    </div>
                    <div className="text-right text-sm">
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
                </Button>

                <div className="text-center text-sm">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-primary hover:underline"
                  >
                    {isLogin
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <MFAChallenge
          open={showMFAChallenge}
          onSuccess={handleMFASuccess}
          onCancel={handleMFACancel}
        />

        <EmailMFAChallenge
          open={showEmailMFA}
          email={email}
          onSuccess={handleMFASuccess}
          onCancel={handleMFACancel}
        />
      </div>
    </div>
  );
};

export default Auth;
