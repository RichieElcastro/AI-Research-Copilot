import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppNavbar } from './components/common/AppNavbar';
import { ProjectList } from './components/projects/ProjectList';
import { ProjectWorkspace } from './components/dashboard/ProjectWorkspace';
import { ResearchProject } from './types';
import { ShieldCheck } from 'lucide-react';

function MainContent() {
  const { currentUser } = useAuth();
  const [activeProject, setActiveProject] = useState<ResearchProject | null>(null);

  const handleOpenProject = (project: ResearchProject) => {
    setActiveProject(project);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToProjects = () => {
    setActiveProject(null);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Global Academic Navigation Bar */}
      <AppNavbar
        onNavigateHome={handleBackToProjects}
        activeProjectTitle={activeProject?.title}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeProject ? (
          <ProjectWorkspace
            projectId={activeProject.id}
            onBackToProjects={handleBackToProjects}
          />
        ) : (
          <ProjectList onOpenProject={handleOpenProject} />
        )}
      </main>

      {/* Academic Rigor Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-800">Quantitative Research Platform</span>
            <span className="text-slate-400">•</span>
            <span>Phase 1: Foundation + Research Project + Variable Builder</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Deterministic Business Logic • Strict Cross-Researcher Data Isolation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </ToastProvider>
  );
}
