import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EditProfileModalProps {
  contestant: {
    id: string;
    full_name: string;
    photo_url: string | null;
  };
  onUpdate: () => void;
}

export function EditProfileModal({ contestant, onUpdate }: EditProfileModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(contestant.photo_url);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!photoFile) {
      toast({
        title: "No photo selected",
        description: "Please select a new photo to upload.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      const fileExt = photoFile.name.split('.').pop();
      const fileName = `${contestant.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('contestant-photos')
        .upload(fileName, photoFile, { upsert: true });

      if (uploadError) {
        throw new Error("Failed to upload photo");
      }

      const { data: urlData } = supabase.storage
        .from('contestant-photos')
        .getPublicUrl(fileName);
      
      const photoUrl = urlData.publicUrl;

      // Update only the photo_url
      const { error: updateError } = await supabase
        .from("contestants")
        .update({ photo_url: photoUrl })
        .eq("id", contestant.id);

      if (updateError) {
        throw new Error("Failed to update photo");
      }

      toast({
        title: "Photo Updated",
        description: "Your photo has been updated successfully.",
      });
      
      setOpen(false);
      setPhotoFile(null);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors border-2 border-section-blue"
          aria-label="Edit photo"
        >
          <Pencil className="w-4 h-4 text-section-blue" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-section-blue border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Update Photo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Preview */}
          <div className="flex justify-center">
            <label className="cursor-pointer relative group">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Profile preview"
                  className="w-32 h-32 rounded-full object-cover border-2 border-white/50"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center text-4xl border-2 border-white/50">
                  👶
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="w-6 h-6 text-white" />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-center text-sm text-white/70">Click photo to select a new one</p>

          <Button
            type="submit"
            disabled={loading || !photoFile}
            className="w-full bg-white text-section-blue hover:bg-gray-100 disabled:opacity-50"
          >
            {loading ? "Uploading..." : "Update Photo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
