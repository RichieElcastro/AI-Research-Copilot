import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Play, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { variableService } from '../../services/variableService';
import { instrumentService } from '../../services/instrumentService';
import { scaleService } from '../../services/scaleService';
import { Modal } from '../common/Modal';

interface SecurityTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestResult {
  name: string;
  target: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  message: string;
}

export const SecurityTestModal: React.FC<SecurityTestModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, users } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runSecurityAudit = () => {
    if (!currentUser) return;
    setIsRunning(true);
    const newResults: TestResult[] = [];

    // Find an alternate user
    const otherUser = users.find(u => u.id !== currentUser.id) || {
      id: 'usr_adversary_imposter',
      name: 'Unauthorized Imposter',
    };

    // Find all projects in system
    const allProjects = projectService._getAllProjects();
    const otherUserProjects = allProjects.filter(p => p.userId === otherUser.id);
    const targetForeignProjectId = otherUserProjects[0]?.id || 'proj_foreign_test_isolated';

    // TEST 1: Attempt to read foreign project via projectService
    const res1 = projectService.getProject(targetForeignProjectId, currentUser.id);
    newResults.push({
      name: 'Cross-Tenant Read Project Denial',
      target: `projectService.getProject("${targetForeignProjectId}", "${currentUser.id}")`,
      expectedStatus: 403,
      actualStatus: res1.statusCode || (res1.success ? 200 : 403),
      passed: !res1.success && res1.statusCode === 403,
      message: res1.error || 'Access unexpectedly allowed',
    });

    // TEST 2: Attempt to read variables belonging to a foreign project
    const res2 = variableService.getVariables(targetForeignProjectId, currentUser.id);
    newResults.push({
      name: 'Cross-Tenant Variables Query Denial',
      target: `variableService.getVariables("${targetForeignProjectId}", "${currentUser.id}")`,
      expectedStatus: 403,
      actualStatus: res2.statusCode || (res2.success ? 200 : 403),
      passed: !res2.success && res2.statusCode === 403,
      message: res2.error || 'Access unexpectedly allowed',
    });

    // TEST 3: Attempt to inject variable into foreign project
    const res3 = variableService.createVariable(
      targetForeignProjectId,
      currentUser.id,
      currentUser.name,
      {
        name: 'Unauthorized Variable Injection',
        code: 'HACK1',
        role: 'Independent Variable',
        measurementScale: 'Interval',
      }
    );
    newResults.push({
      name: 'Cross-Tenant Variable Insertion Denial',
      target: `variableService.createVariable("${targetForeignProjectId}", ...)`,
      expectedStatus: 403,
      actualStatus: res3.statusCode || (res3.success ? 201 : 403),
      passed: !res3.success && res3.statusCode === 403,
      message: res3.error || 'Variable insertion unexpectedly allowed',
    });

    // TEST 4: Attempt to delete foreign project
    const res4 = projectService.deleteProject(
      targetForeignProjectId,
      currentUser.id,
      currentUser.name
    );
    newResults.push({
      name: 'Cross-Tenant Destructive Deletion Denial',
      target: `projectService.deleteProject("${targetForeignProjectId}", ...)`,
      expectedStatus: 403,
      actualStatus: res4.statusCode || (res4.success ? 200 : 403),
      passed: !res4.success && res4.statusCode === 403,
      message: res4.error || 'Project deletion unexpectedly allowed',
    });

    // TEST 5: Attempt to read instruments of a foreign project
    const res5 = instrumentService.getInstruments(targetForeignProjectId, currentUser.id);
    newResults.push({
      name: 'Cross-Tenant Instruments Access Denial',
      target: `instrumentService.getInstruments("${targetForeignProjectId}", "${currentUser.id}")`,
      expectedStatus: 403,
      actualStatus: res5.statusCode || (res5.success ? 200 : 403),
      passed: !res5.success && res5.statusCode === 403,
      message: res5.error || 'Instruments query unexpectedly allowed',
    });

    // TEST 6: Attempt to read scales of a foreign project
    const res6 = scaleService.getScales(targetForeignProjectId, currentUser.id);
    newResults.push({
      name: 'Cross-Tenant Scale Library Access Denial',
      target: `scaleService.getScales("${targetForeignProjectId}", "${currentUser.id}")`,
      expectedStatus: 403,
      actualStatus: res6.statusCode || (res6.success ? 200 : 403),
      passed: !res6.success && res6.statusCode === 403,
      message: res6.error || 'Custom scale query unexpectedly allowed',
    });

    setResults(newResults);
    setIsRunning(false);
  };

  const allPassed = results.length > 0 && results.every(r => r.passed);

  return (
    <Modal
      id="security-test-modal"
      isOpen={isOpen}
      onClose={onClose}
      title="Security & Authorization Penetration Suite"
      subtitle="Verifies database/service layer authorization preventing unauthorized cross-researcher access"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
          <p className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Backend Authorization Guarantee
          </p>
          This verification test attempts unauthorized requests using the current authenticated session (
          <span className="font-mono text-indigo-700 font-semibold">{currentUser?.name}</span>) targeting
          another researcher's projects and variable repositories. Every operation must fail with{' '}
          <span className="font-mono font-bold text-rose-700">403 Forbidden</span>.
        </div>

        <div className="flex justify-between items-center pt-2">
          <div>
            <span className="text-xs text-slate-500">
              Active User ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">{currentUser?.id}</code>
            </span>
          </div>
          <button
            type="button"
            id="btn-run-security-suite"
            onClick={runSecurityAudit}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            {isRunning ? 'Auditing Layer Security...' : 'Execute Security Audit'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Audit Results</p>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                  allPassed
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {allPassed ? '✓ All Security Tests Passed' : '✗ Security Vulnerabilities Detected'}
              </span>
            </div>

            <div className="space-y-2">
              {results.map((res, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs ${
                    res.passed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {res.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{res.name}</p>
                        <p className="font-mono text-[10px] text-slate-500 mt-0.5 break-all">{res.target}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        res.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      HTTP {res.actualStatus}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600 italic bg-white/70 p-1.5 rounded border border-slate-200/60">
                    "{res.message}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
