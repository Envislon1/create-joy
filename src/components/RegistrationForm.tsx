import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RegistrationFormProps {
  onSuccess: (slug: string) => void;
}

export function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !age || !sex) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let photoUrl = null;

      if (photo) {
        const fileExt = photo.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError, data } = await supabase.storage
          .from("contestant-photos")
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("contestant-photos")
          .getPublicUrl(fileName);

        photoUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("contestants")
        .insert({
          full_name: fullName,
          age: parseInt(age),
          sex: sex,
          photo_url: photoUrl,
        })
        .select("unique_slug")
        .single();

      if (error) throw error;

      toast({ title: "Registration successful!" });
      onSuccess(data.unique_slug);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Register Your Child</h2>
      
      <div>
        <label className="block text-sm mb-1">Full Name *</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full border border-border p-2 rounded"
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Age *</label>
        <select
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full border border-border p-2 rounded"
          required
        >
          <option value="">Select Age</option>
          <option value="0">Under 1</option>
          {Array.from({ length: 9 }, (_, i) => i + 1).map((year) => (
            <option key={year} value={year.toString()}>
              {year} year{year !== 1 ? 's' : ''} old
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Sex *</label>
        <select
          value={sex}
          onChange={(e) => setSex(e.target.value)}
          className="w-full border border-border p-2 rounded"
          required
        >
          <option value="">Select</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Photo</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          className="w-full border border-border p-2 rounded"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-primary-foreground p-2 rounded disabled:opacity-50"
      >
        {loading ? "Registering..." : "Register"}
      </button>
    </form>
  );
}
