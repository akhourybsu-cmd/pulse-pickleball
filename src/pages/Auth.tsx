import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { MFAChallenge } from "@/components/auth/MFAChallenge";
import { EmailMFAChallenge } from "@/components/auth/EmailMFAChallenge";

const authSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72, "Password too long"),
  fullName: z.string().trim().min(1, "Name is required").max(100, "Name too long").optional(),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showMFAChallenge, setShowMFAChallenge] = useState(false);
  const [showEmailMFA, setShowEmailMFA] = useState(false);
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "email" | "none">("none");
  const navigate = useNavigate();

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
        
        // Check user's MFA preference from profile
        if (data.session) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("mfa_method")
            .eq("id", data.user?.id)
            .single();

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
          
          // No MFA enabled, proceed to dashboard
          toast.success("Logged in successfully!");
          setTimeout(() => {
            navigate("/dashboard");
          }, 100);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: validationResult.data.email,
          password: validationResult.data.password,
          options: {
            data: {
              full_name: validationResult.data.fullName,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Account created! Redirecting to dashboard...");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
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
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleMFASuccess = () => {
    setShowMFAChallenge(false);
    setShowEmailMFA(false);
    toast.success("Logged in successfully!");
    setTimeout(() => {
      navigate("/dashboard");
    }, 100);
  };

  const handleMFACancel = async () => {
    setShowMFAChallenge(false);
    setShowEmailMFA(false);
    await supabase.auth.signOut();
    toast.info("Login cancelled");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
            PULSE
          </h1>
          <p className="text-muted-foreground">
            Pickleball Universal Level & Skill Estimator
          </p>
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

                {isLogin && (
                  <div className="text-right text-sm">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
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
