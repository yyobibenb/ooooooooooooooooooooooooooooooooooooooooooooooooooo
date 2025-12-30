import { Button } from "@/components/ui/button";
import { Terminal, Code2, Sparkles, Cpu } from "lucide-react";
import { motion } from "framer-motion";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="border-b border-white/5 bg-background/50 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">ReplClone</span>
          </div>
          <Button onClick={handleLogin} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
            Login
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center z-10 px-4">
        <div className="text-center max-w-3xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-400">
              Code, Create, <br />
              <span className="text-primary">Collaborate.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              An instant IDE for the web. Build software faster with an AI-powered editor, zero-config environments, and instant deployments.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={handleLogin} className="w-full sm:w-auto text-base px-8 h-12 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1 transition-all">
                Start Coding for Free
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-12 rounded-full border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-sm">
                View Documentation
              </Button>
            </div>
          </motion.div>

          {/* Feature Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20"
          >
            <div className="glass-panel p-6 rounded-2xl text-left">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 text-blue-400">
                <Code2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Instant Environment</h3>
              <p className="text-sm text-muted-foreground">
                Spin up a dev environment in seconds. No setup, no config files, just code.
              </p>
            </div>
            <div className="glass-panel p-6 rounded-2xl text-left">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 text-purple-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Assisted</h3>
              <p className="text-sm text-muted-foreground">
                Built-in AI chat that understands your codebase and helps you write better code faster.
              </p>
            </div>
            <div className="glass-panel p-6 rounded-2xl text-left">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4 text-green-400">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Powerful Compute</h3>
              <p className="text-sm text-muted-foreground">
                Run anything from simple scripts to complex full-stack applications in the cloud.
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="py-8 text-center text-sm text-muted-foreground border-t border-white/5 bg-background z-10">
        <p>© 2024 ReplClone. Built with ❤️.</p>
      </footer>
    </div>
  );
}
