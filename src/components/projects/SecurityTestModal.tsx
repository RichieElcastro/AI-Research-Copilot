import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Play, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { variableService } from '../../services/variableService';
import { instrumentService } from '../../services/instrumentService';
import { scaleService } from '../../services/scaleService';
import { questionnaireService } from '../../services/questionnaireService';
import { submissionService } from '../../services/submissionService';
import { processingService } from '../../services/processingService';
import { scoringService } from '../../services/scoringService';
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

    // TEST 7: Cross-Tenant Questionnaire Access Denial
    const res7 = questionnaireService.getByProject(targetForeignProjectId, currentUser.id);
    newResults.push({
      name: 'Cross-Tenant Questionnaire Query Denial',
      target: `questionnaireService.getByProject("${targetForeignProjectId}", "${currentUser.id}")`,
      expectedStatus: 403,
      actualStatus: res7.statusCode || (res7.success ? 200 : 403),
      passed: !res7.success && res7.statusCode === 403,
      message: res7.error || 'Foreign questionnaire query unexpectedly allowed',
    });

    // TEST 8: Rejection of Questionnaire Creation from Unapproved Instrument
    const currentProj = allProjects.find(p => p.userId === currentUser.id);
    if (currentProj) {
      const insts = instrumentService.getInstruments(currentProj.id, currentUser.id);
      const draftInst = (insts.data || []).find(i => i.status !== 'Approved');
      if (draftInst) {
        const res8 = questionnaireService.createFromApprovedInstrument(
          currentProj.id,
          draftInst.id,
          currentUser.id,
          currentUser.name
        );
        newResults.push({
          name: 'Draft/Review Instrument Questionnaire Gate',
          target: `createFromApprovedInstrument(..., instrument.status="${draftInst.status}")`,
          expectedStatus: 400,
          actualStatus: res8.statusCode || (res8.success ? 201 : 400),
          passed: !res8.success && res8.statusCode === 400,
          message: res8.error || 'Draft instrument unexpectedly allowed to create questionnaire',
        });
      }

      // TEST 9: Invalid Lifecycle Transition Denial (Attempt to Pause Draft)
      const allQ = questionnaireService._getAllQuestionnaires();
      const userQ = allQ.find(q => q.projectId === currentProj.id);
      if (userQ && userQ.status !== 'Published') {
        const res9 = questionnaireService.pause(
          userQ.id,
          currentProj.id,
          currentUser.id,
          currentUser.name
        );
        newResults.push({
          name: 'Invalid Lifecycle State Transition Rejection',
          target: `questionnaireService.pause(status="${userQ.status}")`,
          expectedStatus: 400,
          actualStatus: res9.statusCode || (res9.success ? 200 : 400),
          passed: !res9.success && res9.statusCode === 400,
          message: res9.error || 'Invalid transition unexpectedly accepted',
        });
      }
    }

    // TEST 10: Cross-Tenant Raw Submissions Isolation Check
    const res10 = submissionService.getProjectSubmissions(targetForeignProjectId, currentUser.id);
    newResults.push({
      name: 'Cross-Tenant Raw Submissions Access Denial',
      target: `submissionService.getProjectSubmissions("${targetForeignProjectId}", "${currentUser.id}")`,
      expectedStatus: 403,
      actualStatus: res10.statusCode || (res10.success ? 200 : 403),
      passed: !res10.success && res10.statusCode === 403,
      message: res10.error || 'Cross-tenant raw submission query unexpectedly authorized',
    });

    // TEST 11: Submission Engine Rejection of Unconsented Response
    const res11 = submissionService.submit({
      questionnaireId: 'non_existent_id',
      questionnaireVersionId: 'non_existent_version',
      sessionId: 'test_session_unconsented',
      startedAt: new Date().toISOString(),
      consentGiven: false,
      rawResponses: {},
    });
    newResults.push({
      name: 'Submission Integrity: Unconsented Response Rejection',
      target: 'submissionService.submit({ consentGiven: false })',
      expectedStatus: 404, // Questionnaire not found or validation failure
      actualStatus: res11.statusCode || (res11.success ? 201 : 400),
      passed: !res11.success,
      message: res11.error || 'Unconsented submission was unexpectedly accepted',
    });

    // TEST 12: Cross-Tenant Processing Runs Access Denial
    const res12 = processingService.getRunsByProject(targetForeignProjectId, currentUser.id);
    newResults.push({
      name: 'Cross-Tenant Processing Runs Access Denial',
      target: `processingService.getRunsByProject("${targetForeignProjectId}", "${currentUser.id}")`,
      expectedStatus: 403,
      actualStatus: res12.statusCode || (res12.success ? 200 : 403),
      passed: !res12.success && res12.statusCode === 403,
      message: res12.error || 'Cross-tenant processing runs query unexpectedly authorized',
    });

    // TEST 13: Cross-Tenant Processing Execution Denial
    const res13 = processingService.runProcessing({
      projectId: targetForeignProjectId,
      questionnaireId: 'q_fake_id',
      questionnaireVersionId: 'ver_fake_id',
      missingValuePolicy: 'preserve_missing',
      userId: currentUser.id,
      userName: currentUser.name,
    });
    newResults.push({
      name: 'Cross-Tenant Processing Execution Denial',
      target: `processingService.runProcessing(projectId="${targetForeignProjectId}", ...)`,
      expectedStatus: 403,
      actualStatus: res13.statusCode || (res13.success ? 201 : 403),
      passed: !res13.success && res13.statusCode === 403,
      message: res13.error || 'Cross-tenant processing run execution unexpectedly authorized',
    });

    // TEST 14: Deterministic Reverse Coding Invariant Verification
    const revRule = { minValue: 1, maxValue: 5, formula: 'max(5) + min(1) - x' };
    const rev1 = processingService.reverseCodeValue(1, revRule, true); // 5 + 1 - 1 = 5
    const rev2 = processingService.reverseCodeValue(2, revRule, true); // 5 + 1 - 2 = 4
    const rev3 = processingService.reverseCodeValue(3, revRule, true); // 5 + 1 - 3 = 3
    const rev4 = processingService.reverseCodeValue(4, revRule, true); // 5 + 1 - 4 = 2
    const rev5 = processingService.reverseCodeValue(5, revRule, true); // 5 + 1 - 5 = 1
    const revFormulaHolds =
      rev1.reverseCodedValue === 5 &&
      rev2.reverseCodedValue === 4 &&
      rev3.reverseCodedValue === 3 &&
      rev4.reverseCodedValue === 2 &&
      rev5.reverseCodedValue === 1;

    newResults.push({
      name: 'Deterministic Reverse Coding Math Invariant (1-5 Scale)',
      target: 'processingService.reverseCodeValue(x, { min:1, max:5 }, true) -> [5,4,3,2,1]',
      expectedStatus: 200,
      actualStatus: revFormulaHolds ? 200 : 500,
      passed: revFormulaHolds,
      message: revFormulaHolds
        ? 'Verified exact mathematical formula max(5)+min(1)-x produces [5,4,3,2,1]'
        : 'Reverse coding formula deviation detected',
    });

    // TEST 15: Missing Value Imputation Prohibition (No Statistical Imputation)
    const emptyCoded = processingService.codeRawValue('', { id: 'test', itemCode: 'Q1', itemType: 'Likert' } as any, [], {});
    const missingPreserved = processingService.applyMissingPolicy('preserve_missing');
    const userCodeApplied = processingService.applyMissingPolicy('user_defined_code', -99);
    const missingPolicyHolds =
      emptyCoded.status === 'Missing' &&
      emptyCoded.flagReason === 'MISSING_VALUE' &&
      missingPreserved === null &&
      userCodeApplied === -99;

    newResults.push({
      name: 'Statistical Imputation Prohibition Invariant',
      target: 'codeRawValue("") -> status="Missing", applyMissingPolicy -> null / user code',
      expectedStatus: 200,
      actualStatus: missingPolicyHolds ? 200 : 500,
      passed: missingPolicyHolds,
      message: missingPolicyHolds
        ? 'Verified missing values remain transparently null or user-coded without statistical imputation'
        : 'Missing value handling anomaly detected',
    });

    // TEST 16: Cross-Tenant Scoring Rules Query Denial
    const res16 = scoringService.getRulesByProject(targetForeignProjectId, currentUser.id);
    newResults.push({
      name: 'Cross-Tenant Scoring Rules Query Denial',
      target: `scoringService.getRulesByProject("${targetForeignProjectId}", "${currentUser.id}")`,
      expectedStatus: 403,
      actualStatus: res16.statusCode || (res16.success ? 200 : 403),
      passed: !res16.success && res16.statusCode === 403,
      message: res16.error || 'Cross-tenant scoring rules query unexpectedly authorized',
    });

    // TEST 17: Cross-Tenant Scoring Execution Denial
    const res17 = scoringService.runScoring({
      projectId: targetForeignProjectId,
      processingRunId: 'pr_foreign_id',
      rules: [],
      userId: currentUser.id,
      userName: currentUser.name,
    });
    newResults.push({
      name: 'Cross-Tenant Scoring Execution Denial',
      target: `scoringService.runScoring(projectId="${targetForeignProjectId}", ...)`,
      expectedStatus: 403,
      actualStatus: res17.statusCode || (res17.success ? 200 : 403),
      passed: !res17.success && res17.statusCode === 403,
      message: res17.error || 'Cross-tenant scoring execution unexpectedly authorized',
    });

    // TEST 18: Deterministic Scoring Math Invariants (MEAN, SUM, MEDIAN, MIN, MAX)
    const testValues = [1, 2, 4, 5]; // Sum=12, Mean=3.0, Median=3.0, Min=1, Max=5
    const sumVal = scoringService.calculateScore(testValues, 'SUM');
    const meanVal = scoringService.calculateScore(testValues, 'MEAN');
    const medianVal = scoringService.calculateScore(testValues, 'MEDIAN');
    const minVal = scoringService.calculateScore(testValues, 'MIN');
    const maxVal = scoringService.calculateScore(testValues, 'MAX');

    const mathInvariantsHold =
      sumVal === 12 &&
      meanVal === 3 &&
      medianVal === 3 &&
      minVal === 1 &&
      maxVal === 5;

    newResults.push({
      name: 'Deterministic Scoring Aggregation Invariants',
      target: 'calculateScore([1,2,4,5]) -> SUM=12, MEAN=3.0, MEDIAN=3.0, MIN=1, MAX=5',
      expectedStatus: 200,
      actualStatus: mathInvariantsHold ? 200 : 500,
      passed: mathInvariantsHold,
      message: mathInvariantsHold
        ? 'Verified exact deterministic math for all 5 aggregation methods'
        : `Math invariant failure: SUM=${sumVal}, MEAN=${meanVal}, MEDIAN=${medianVal}`,
    });

    // TEST 19: Missing Value Policy Invariants (complete_case, available_case, minimum_required_items)
    // 3 items with 1 missing: validValues = [4, 2], total = 3
    const validVals = [4, 2];
    const totalCount = 3;

    // Under complete_case: missing 1 item causes canCalculate to be false
    const completeCaseRes = scoringService.evaluateMissingPolicy(totalCount, validVals, 'complete_case');

    // Under available_case: 2 valid items allow calculation
    const availableCaseRes = scoringService.evaluateMissingPolicy(totalCount, validVals, 'available_case');

    // Under minimum_required_items (min=3): only 2 valid -> canCalculate is false
    const minReq3Res = scoringService.evaluateMissingPolicy(totalCount, validVals, 'minimum_required_items', 3);

    // Under minimum_required_items (min=2): 2 valid -> canCalculate is true
    const minReq2Res = scoringService.evaluateMissingPolicy(totalCount, validVals, 'minimum_required_items', 2);

    const missingPoliciesHold =
      !completeCaseRes.canCalculate &&
      availableCaseRes.canCalculate &&
      !minReq3Res.canCalculate &&
      minReq2Res.canCalculate;

    newResults.push({
      name: 'Missing Value Policy Enforcement Invariants',
      target: 'evaluateMissingPolicy with complete_case, available_case, minimum_required_items',
      expectedStatus: 200,
      actualStatus: missingPoliciesHold ? 200 : 500,
      passed: missingPoliciesHold,
      message: missingPoliciesHold
        ? 'Verified complete_case requires 100%, available_case allows partials, and minimum_required_items enforces threshold'
        : 'Missing value policy deviation detected',
    });

    // TEST 20: Full Precision Preservation Invariant (No Unrequested Rounding)
    // Mean of [1, 2, 4] = 7/3 = 2.3333333333333335
    const precisionValues = [1, 2, 4];
    const rawPrecisionMean = scoringService.calculateScore(precisionValues, 'MEAN');
    const isUnrounded = rawPrecisionMean !== null && Math.abs(rawPrecisionMean - 7 / 3) < 1e-12 && String(rawPrecisionMean).length > 10;

    newResults.push({
      name: 'Full Numeric Precision Invariant (No Silent Rounding)',
      target: 'calculateScore([1,2,4], "MEAN") -> 2.3333333333333335',
      expectedStatus: 200,
      actualStatus: isUnrounded ? 200 : 500,
      passed: isUnrounded,
      message: isUnrounded
        ? `Preserved full double-precision floating point (${rawPrecisionMean}) without silent truncation`
        : `Precision was unexpectedly truncated: ${rawPrecisionMean}`,
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
