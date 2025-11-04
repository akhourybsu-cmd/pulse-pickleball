import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { MFAChallenge } from "@/components/auth/MFAChallenge";
import { EmailMFAChallenge } from "@/components/auth/EmailMFAChallenge";
import pulseLogo from "@/assets/pulse-logo-new.png";

const authSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password too long"),
  fullName: z.string().trim().min(1, "Name is required").max(100, "Name too long").optional(),
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
  const [fullName, setFullName] = useState("");
  const [showMFAChallenge, setShowMFAChallenge] = useState(false);
  const [showEmailMFA, setShowEmailMFA] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "email" | "none">("none");
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const navigate = useNavigate();

  // Check session persistence on mount
  useEffect(() => {
    const checkSessionPersistence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const sessionFlag = sessionStorage.getItem('pulse_stay_signed_in');
      
      // If we have a session but no sessionStorage flag, user didn't want to stay signed in
      if (session && !sessionFlag) {
        await supabase.auth.signOut();
      }
    };
    
    checkSessionPersistence();
  }, []);

  const checkLocationAccess = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.error("Geolocation is not supported by your browser");
        resolve(false);
        return;
      }

      setCheckingLocation(true);
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // Call server-side validation edge function
            const { data, error } = await supabase.functions.invoke('validate-signup-location', {
              body: { latitude, longitude }
            });

            setCheckingLocation(false);

            if (error) {
              console.error("Location validation error:", error);
              toast.error("Unable to verify your location. Please try again.");
              resolve(false);
              return;
            }

            if (data.allowed) {
              resolve(true);
            } else {
              toast.error(data.message || "Account creation is only available for Massachusetts and Rhode Island residents.");
              resolve(false);
            }
          } catch (error) {
            setCheckingLocation(false);
            console.error("Location validation error:", error);
            toast.error("Unable to verify your location. Please try again.");
            resolve(false);
          }
        },
        (error) => {
          setCheckingLocation(false);
          
          if (error.code === error.PERMISSION_DENIED) {
            toast.error("Location permission denied. You must allow location access to create an account.");
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            toast.error("Location information unavailable. Please enable location services.");
          } else {
            toast.error("Unable to retrieve your location. Please try again.");
          }
          
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input
      const validationResult = authSchema.safeParse({
        email,
        password,
        fullName: isLogin ? undefined : fullName,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: validationResult.data.email,
          password: validationResult.data.password,
        });
        
        if (error) throw error;

        // Handle session persistence based on checkbox
        if (staySignedIn) {
          // Set flag in sessionStorage so we know user wants to stay signed in
          sessionStorage.setItem('pulse_stay_signed_in', 'true');
        } else {
          // Don't set the flag - session will be cleared on browser close
          sessionStorage.setItem('pulse_stay_signed_in', 'false');
          
          // Set up listener to clear session when tab/window closes
          const handleBeforeUnload = () => {
            sessionStorage.removeItem('pulse_stay_signed_in');
          };
          
          window.addEventListener('beforeunload', handleBeforeUnload);
        }
        
        // Check user's MFA preference from profile (with timeout)
        if (data.session) {
          try {
            // Add timeout to prevent hanging on slow profile queries
            const profilePromise = supabase
              .from("profiles")
              .select("mfa_method")
              .eq("id", data.user?.id)
              .maybeSingle();

            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Profile query timeout")), 3000)
            );

            const { data: profile } = await Promise.race([profilePromise, timeoutPromise]) as any;

            const userMFAMethod = profile?.mfa_method || "none";
            setMfaMethod(userMFAMethod as "authenticator" | "email" | "none");

            if (userMFAMethod === "authenticator") {
              const { data: factors } = await supabase.auth.mfa.listFactors();
              const hasMFA = factors?.totp?.some((factor) => factor.status === "verified");
              
              if (hasMFA) {
                setShowMFAChallenge(true);
                setLoading(false);
                return;
              }
            } else if (userMFAMethod === "email") {
              setShowEmailMFA(true);
              setLoading(false);
              return;
            }
          } catch (err) {
            // If profile query fails or times out, skip MFA check and proceed
            console.warn("MFA check skipped due to error:", err);
          }
          
          // No MFA enabled or MFA check failed, proceed to redirect path
          toast.success("Logged in successfully!");
          navigate(redirectPath);
        }
      } else {
        // Sign-up validation: check email and password match
        if (email !== confirmEmail) {
          toast.error("Email addresses do not match");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setLoading(false);
          return;
        }

        // Check location before allowing signup
        const locationAllowed = await checkLocationAccess();
        if (!locationAllowed) {
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: validationResult.data.email,
          password: validationResult.data.password,
          options: {
            data: {
              full_name: validationResult.data.fullName,
            },
            emailRedirectTo: `${window.location.origin}${redirectPath}`,
          },
        });
        if (error) throw error;
        toast.success("Account created! Please check your email to verify your account.");
        setIsLogin(true);
        setEmail("");
        setConfirmEmail("");
        setPassword("");
        setConfirmPassword("");
        setFullName("");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      toast.error(errorMessage);
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
        redirectTo: `${window.location.origin}/auth`,
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
            ) : (
              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Enter your full name"
                    />
                  </div>
                )}
                
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
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-500">Passwords must match</p>
                    )}
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

                <Button type="submit" className="w-full" disabled={loading || checkingLocation}>
                  {checkingLocation ? "Checking location..." : loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
                </Button>
                
                {!isLogin && (
                  <p className="text-xs text-muted-foreground text-center">
                    Account creation requires location access to verify MA/RI residency
                  </p>
                )}

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
