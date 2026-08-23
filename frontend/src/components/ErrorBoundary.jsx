import * as React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "./ui/Button";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#030712] text-white p-6 relative overflow-hidden">
          {/* Decorative glowing backgrounds */}
          <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-secondary/10 rounded-full blur-[100px] -z-10"></div>

          <div className="w-full max-w-lg p-8 rounded-[2rem] border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6 border border-rose-500/20 text-rose-500 animate-bounce">
              <AlertTriangle size={40} />
            </div>
            
            <h1 className="text-3xl font-extrabold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-base mb-6 max-w-md">
              An unexpected runtime error occurred. The application was saved from crashing by our stability shields.
            </p>

            {this.state.error && (
              <div className="w-full text-left bg-slate-950/60 border border-white/5 rounded-2xl p-4 mb-6 font-mono text-xs text-rose-400 max-h-[150px] overflow-auto hide-scrollbar">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <Button onClick={this.handleReset} className="gap-2 bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-lg shadow-primary/20">
                <RefreshCw size={16} /> Recover App
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()} className="gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-white">
                Force Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
