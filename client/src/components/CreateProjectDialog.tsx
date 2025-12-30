import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GlassButton, GlassInput } from "./GlassComponents";
import { useCreateProject } from "@/hooks/use-projects";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { mutate, isPending } = useCreateProject();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    mutate(
      { name, description, userId: "temp" }, // userId handled by backend auth middleware but schema requires string
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDescription("");
          toast({ title: "Project created", description: "Start coding!" });
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <GlassButton icon={<Plus className="w-4 h-4" />}>New Project</GlassButton>
      </DialogTrigger>
      <DialogContent className="glass-panel border-white/10 bg-black/80 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Project Name</label>
            <GlassInput
              placeholder="my-awesome-app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Description (Optional)</label>
            <GlassInput
              placeholder="A brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end pt-4">
            <GlassButton type="submit" isLoading={isPending} className="w-full">
              Create Project
            </GlassButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
