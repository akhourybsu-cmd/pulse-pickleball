import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
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
import { lovable } from "@/integrations/lovable";
import { Logo } from "@/components/Logo";

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.9 0 3.16.8 3.88 1.5l2.65-2.55C16.94 3.3 14.7 2.3 12 2.3 6.85 2.3 2.7 6.45 2.7 11.6S6.85 20.9 12 20.9c6.93 0 9.3-4.87 9.3-9.4 0-.63-.07-1.1-.16-1.3H12z"/>
  </svg>
);

const AppleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.466 2.23-1.226 3.01-.816.84-2.144 1.49-3.235 1.41-.135-1.1.418-2.25 1.142-3.01.81-.85 2.213-1.49 3.319-1.41zM20.5 17.27c-.55 1.28-.81 1.85-1.52 2.98-.99 1.57-2.39 3.53-4.12 3.55-1.54.02-1.94-1.01-4.03-1-2.09.01-2.53 1.02-4.07 1-1.73-.02-3.06-1.79-4.05-3.36C.92 17.54-.13 12.6 1.96 9.34 3.43 7.06 5.77 5.71 7.99 5.71c2.26 0 3.68 1.24 5.55 1.24 1.81 0 2.92-1.24 5.54-1.24 1.97 0 4.07 1.08 5.55 2.94-4.88 2.67-4.09 9.65.87 8.62z"/>
  </svg>
);

// State list comes from the shared module; Auth historically stores the FULL
// state name (not the 2-letter code), so we use US_STATE_NAMES here. Keep this
// format until a deliberate data migration switches to codes everywhere.
import { US_STATE_NAMES } from "@/lib/us-states";

// Zod needs a non-empty tuple at compile time. The shared array is readonly
// string[], so we cast to the tuple shape Zod expects without changing values.
const US_STATE_NAMES_TUPLE = US_STATE_NAMES as unknown as readonly [string, ...string[]];

const authSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password too long"),
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name too long").optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(50, "Last name too long").optional(),
  state: z.enum(US_STATE_NAMES_TUPLE, {
    errorMap: () => ({ message: "Please select your state" }),
  }).optional(),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  // Auth bounce protocol: AuthGuard now passes the full URL (pathname +
  // search + hash) as `returnTo` in location.state. Preferred over the
  // legacy ?redirect=… query param because it preserves search params
  // like ?invite=XYZ-ABCD that the player tried to deep-link with.
  const returnFromState = (location.state as { returnTo?: string } | null)?.returnTo;
  // OAuth redirects strip location.state, so we also persist the intended
  // destination in sessionStorage and restore it after the provider bounces
  // back to /auth (or directly to origin).
  const stashedReturn = typeof window !== 'undefined' ? sessionStorage.getItem('pulse_oauth_return') : null;
  const redirectPath = returnFromState || searchParams.get('redirect') || stashedReturn || '/player/dashboard';

  // Already-logged-in detection. If a returning user lands on /auth (via
  // bookmark, deep link, or stale tab), bounce them to their dashboard
  // instead of showing the sign-in form. QoL pass — no form-flash.
  const [sessionChecked, setSessionChecked] = useState(false);
  const [alreadyAuthed, setAlreadyAuthed] = useState(false);

  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
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

  // Session check — runs once on mount. If the user is already signed in,
  // we mark alreadyAuthed=true and show a brief redirect screen instead of
  // the sign-in form.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        setAlreadyAuthed(true);
      }
      setSessionChecked(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Once the session check confirms we're authed, send the user along.
  useEffect(() => {
    if (alreadyAuthed) {
      navigate(redirectPath, { replace: true });
    }
  }, [alreadyAuthed, redirectPath, navigate]);

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

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      localStorage.setItem('pulse_persist_session', staySignedIn.toString());
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin + redirectPath,
      });
      if (result.error) {
        toast.error((result.error as any)?.message || `Could not sign in with ${provider}`);
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate(redirectPath);
    } catch (err: any) {
      toast.error(err?.message || "OAuth sign-in failed");
      setLoading(false);
    }
  };

  const checkBiometricAvailability = async () => {
    if (!email || !isLogin) {
      setShowBiometric(false);
      setBiometricAvailable(false);
      return;
    }

    try {
      // Use the edge function to check biometric availability (bypasses RLS)
      const { data, error } = await supabase.functions.invoke('get-biometric-credentials', {
        body: { email },
      });

      if (error) {
        console.error('Error checking biometric:', error);
        setBiometricAvailable(false);
        setShowBiometric(false);
        return;
      }

      const hasBiometric = data?.biometric_enabled && data?.credentials?.length > 0;
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

  // Short-circuit while we check the session, or while we're bouncing
  // an already-authed user. Avoids the sign-in form flashing on screen
  // for returning users.
  if (!sessionChecked || alreadyAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          {alreadyAuthed && (
            <p className="text-sm text-muted-foreground">Already signed in — taking you in…</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center bg-secondary p-4 pt-8 md:py-12">
      <div className="w-full max-w-md">
        {/* Logo — wordmark inherits cream from text-secondary-foreground
            so it floats on the dark surface as a brand moment instead of
            sitting in a foreign cream rectangle. */}
        <div className="text-center mb-6 md:mb-10 text-secondary-foreground">
          <Link
            to="/"
            className="inline-block hover:opacity-80 transition-opacity"
            aria-label="PULSE — home"
          >
            <Logo className="h-28 md:h-36 w-auto mx-auto" showSubtitle />
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
              <>
                <div className="space-y-2 mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuth("google")}
                    disabled={loading}
                  >
                    <GoogleIcon />
                    <span className="ml-2">Continue with Google</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuth("apple")}
                    disabled={loading}
                  >
                    <AppleIcon />
                    <span className="ml-2">Continue with Apple</span>
                  </Button>
                </div>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                  </div>
                </div>
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
                        onValueChange={(value) => setSelectedState(value)}
                        disabled={loading}
                      >
                        <SelectTrigger id="state">
                          <SelectValue placeholder="Select your state" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATE_NAMES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
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
              </>
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
