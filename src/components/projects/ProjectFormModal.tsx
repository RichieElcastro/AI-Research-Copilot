import React, { useState, useEffect } from 'react';
import { ResearchProject, ProjectStatus } from '../../types';
import { Modal } from '../common/Modal';

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    researchTopic: string;
    researchObjective: string;
    researchMethod: string;
    population: string;
    sampleDescription: string;
    researchDesign: string;
    status: ProjectStatus;
  }) => void;
  initialProject?: ResearchProject | null;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialProject,
}) => {
  const [title, setTitle] = useState('');
  const [researchTopic, setResearchTopic] = useState('');
  const [researchObjective, setResearchObjective] = useState('');
  const [researchMethod, setResearchMethod] = useState('Quantitative Cross-Sectional Survey');
  const [population, setPopulation] = useState('');
  const [sampleDescription, setSampleDescription] = useState('');
  const [researchDesign, setResearchDesign] = useState('Correlational Ex-Post Facto Design');
  const [status, setStatus] = useState<ProjectStatus>('Draft');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProject) {
      setTitle(initialProject.title);
      setResearchTopic(initialProject.researchTopic || '');
      setResearchObjective(initialProject.researchObjective || '');
      setResearchMethod(initialProject.researchMethod || 'Quantitative Cross-Sectional Survey');
      setPopulation(initialProject.population || '');
      setSampleDescription(initialProject.sampleDescription || '');
      setResearchDesign(initialProject.researchDesign || 'Correlational Ex-Post Facto Design');
      setStatus(initialProject.status || 'Draft');
    } else {
      setTitle('');
      setResearchTopic('');
      setResearchObjective('');
      setResearchMethod('Quantitative Cross-Sectional Survey');
      setPopulation('');
      setSampleDescription('');
      setResearchDesign('Correlational Ex-Post Facto Design');
      setStatus('Draft');
    }
    setValidationError(null);
  }, [initialProject, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError('Project title is required.');
      return;
    }

    onSubmit({
      title: title.trim(),
      researchTopic: researchTopic.trim(),
      researchObjective: researchObjective.trim(),
      researchMethod: researchMethod.trim(),
      population: population.trim(),
      sampleDescription: sampleDescription.trim(),
      researchDesign: researchDesign.trim(),
      status,
    });
    onClose();
  };

  return (
    <Modal
      id="project-form-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={initialProject ? 'Edit Research Project Details' : 'Create New Research Project'}
      subtitle="Define your empirical investigation scope, methodology, and target population"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {validationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
            {validationError}
          </div>
        )}

        <div>
          <label htmlFor="proj-title" className="block text-xs font-semibold text-slate-700 mb-1">
            Research Project Title <span className="text-rose-500">*</span>
          </label>
          <input
            id="proj-title"
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Impact of Doomscrolling on Academic Burnout among Undergraduates"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="proj-topic" className="block text-xs font-semibold text-slate-700 mb-1">
              Research Topic / Theme
            </label>
            <input
              id="proj-topic"
              type="text"
              value={researchTopic}
              onChange={e => setResearchTopic(e.target.value)}
              placeholder="e.g. Digital Media Habits & Student Well-being"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="proj-status" className="block text-xs font-semibold text-slate-700 mb-1">
              Investigation Lifecycle Status
            </label>
            <select
              id="proj-status"
              value={status}
              onChange={e => setStatus(e.target.value as ProjectStatus)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            >
              <option value="Draft">Draft (Design & Conceptualization)</option>
              <option value="Data Collection">Data Collection (Surveys Active)</option>
              <option value="Analysis">Analysis (Processing & Testing)</option>
              <option value="Completed">Completed (Finalized & Reported)</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="proj-objective" className="block text-xs font-semibold text-slate-700 mb-1">
            Research Objective / Problem Statement
          </label>
          <textarea
            id="proj-objective"
            rows={3}
            value={researchObjective}
            onChange={e => setResearchObjective(e.target.value)}
            placeholder="State the core objective or question your quantitative analysis intends to address..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900 resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="proj-method" className="block text-xs font-semibold text-slate-700 mb-1">
              Research Method
            </label>
            <input
              id="proj-method"
              type="text"
              value={researchMethod}
              onChange={e => setResearchMethod(e.target.value)}
              placeholder="e.g. Quantitative Cross-Sectional Survey"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="proj-design" className="block text-xs font-semibold text-slate-700 mb-1">
              Research Design
            </label>
            <input
              id="proj-design"
              type="text"
              value={researchDesign}
              onChange={e => setResearchDesign(e.target.value)}
              placeholder="e.g. Correlational Regression Design"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="proj-population" className="block text-xs font-semibold text-slate-700 mb-1">
              Target Population
            </label>
            <input
              id="proj-population"
              type="text"
              value={population}
              onChange={e => setPopulation(e.target.value)}
              placeholder="e.g. Full-time undergraduate students (N ~ 4,500)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="proj-sample" className="block text-xs font-semibold text-slate-700 mb-1">
              Sampling Technique & Target Sample
            </label>
            <input
              id="proj-sample"
              type="text"
              value={sampleDescription}
              onChange={e => setSampleDescription(e.target.value)}
              placeholder="e.g. Stratified random sampling (target n = 250)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="btn-save-project-submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
          >
            {initialProject ? 'Save Changes' : 'Initialize Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
