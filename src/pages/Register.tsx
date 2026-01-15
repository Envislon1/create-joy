import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Register = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    childName: '',
    childAge: '',
    childSex: '',
    agreedToTerms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      toast({
        title: "Login Required",
        description: "Please login to register your child.",
      });
      navigate('/auth');
    }
  }, [user, loading, navigate, toast]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agreedToTerms) {
      toast({
        title: "Error",
        description: "Please agree to the terms and conditions to proceed.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to register a child.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('contestants').insert({
        parent_id: user.id,
        name: formData.childName,
        age: parseInt(formData.childAge),
        sex: formData.childSex === 'male' ? 'Male' : 'Female',
        votes: 0,
        is_approved: false,
      });

      if (error) throw error;

      toast({
        title: "Registration Successful!",
        description: "Your child has been registered and is pending approval.",
      });
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred during registration.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container-main py-16 flex justify-center">
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="container-main py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2">Register Your Child</h1>
            <p className="text-muted-foreground">
              Fill out the form below to register your child for the contest.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Child Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Child Information</h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="childName">Child's Full Name</Label>
                  <Input
                    id="childName"
                    placeholder="Enter child's full name"
                    value={formData.childName}
                    onChange={(e) => handleInputChange('childName', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="childAge">Age</Label>
                    <Select
                      value={formData.childAge}
                      onValueChange={(value) => handleInputChange('childAge', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select age" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
                          <SelectItem key={age} value={String(age)}>
                            {age} {age === 1 ? 'year' : 'years'} old
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="childSex">Sex</Label>
                    <Select
                      value={formData.childSex}
                      onValueChange={(value) => handleInputChange('childSex', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Profile Photo</Label>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload a clear, recent photo of your child. Max file size: 5MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={formData.agreedToTerms}
                onCheckedChange={(checked) => handleInputChange('agreedToTerms', checked as boolean)}
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                I agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline">
                  Terms and Conditions
                </Link>{' '}
                and confirm that I am the parent or legal guardian of the child being registered.
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Register Child'}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Register;
