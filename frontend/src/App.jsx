import { useState } from 'react';
import './index.css';

const API_BASE_URL = 'http://localhost:3000/api';

const DEMO_DATA = {
  "found": true,
  "scan_id": 999,
  "domain": "https://www.example-demo.com/",
  "scan_timestamp": new Date().toISOString(),
  "compliance_score": 26,
  "compliance_level": "Moderate Risk",
  "gdpr_analysis": {
    "audit_meta": {
      "auditor_role": "Senior GDPR & ePrivacy Compliance Auditor",
      "documents_reviewed": ["Privacy Policy", "Cookie Policy"],
      "note": "Demo data for illustration purposes"
    },
    "audit_checklist": [
      // PART A: GENERAL GOVERNANCE
      { "id": 1, "category": "PART A: GENERAL GOVERNANCE & DATA SUBJECT RIGHTS", "question": "Does the policy clearly state the full contact details of the Data Controller?", "verdict": "Yes", "evidence": "Data Controller: Example Corp, contact@example.com", "notes": "Clear identification provided" },
      { "id": 2, "category": "PART A: GENERAL GOVERNANCE & DATA SUBJECT RIGHTS", "question": "Does the policy specify the retention period for personal data?", "verdict": "Partial", "evidence": "Retention mentioned generally but not for specific categories.", "notes": "Needs more detail" },
      { "id": 3, "category": "PART A: GENERAL GOVERNANCE & DATA SUBJECT RIGHTS", "question": "Does the policy list the specific user rights?", "verdict": "Yes", "evidence": "Users have the right to access, rectify, and erase data.", "notes": "Comprehensive list" },
      { "id": 4, "category": "PART A: GENERAL GOVERNANCE & DATA SUBJECT RIGHTS", "question": "Is the DPO contact information provided (if applicable)?", "verdict": "Yes", "evidence": "DPO Contact: dpo@example.com", "notes": "Clearly stated" },
      { "id": 5, "category": "PART A: GENERAL GOVERNANCE & DATA SUBJECT RIGHTS", "question": "Is the purpose of data processing clearly explained?", "verdict": "Yes", "evidence": "Data is used for order processing and analytics.", "notes": "Clear purposes" },
      { "id": 6, "category": "PART A: GENERAL GOVERNANCE & DATA SUBJECT RIGHTS", "question": "Is the legal basis for processing stated?", "verdict": "Yes", "evidence": "Processing is based on consent and contract fulfillment.", "notes": "GDPR compliant basis" },

      // PART B: COOKIES & TRACKING
      { "id": 7, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Is there a clear definition of what cookies are?", "verdict": "Yes", "evidence": "Cookies are small text files stored on your device.", "notes": "Standard definition" },
      { "id": 8, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Does the policy explain the different types of cookies used?", "verdict": "Yes", "evidence": "We use Session, Persistent, and Third-Party cookies.", "notes": "Good breakdown" },
      { "id": 9, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Are third-party cookies explicitly identified?", "verdict": "Partial", "evidence": "Google Analytics is mentioned.", "notes": "List could be more exhaustive" },
      { "id": 10, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Is the purpose of each cookie category explained?", "verdict": "Yes", "evidence": "Analytics cookies help us improve our website.", "notes": "Clear purpose statements" },
      { "id": 11, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Is there a mechanism to accept/reject cookies?", "verdict": "No", "evidence": "User is assumed to consent by browsing.", "notes": "Implicit consent is not GDPR compliant" },
      { "id": 12, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Can users withdraw consent easily?", "verdict": "Partial", "evidence": "Users can change browser settings.", "notes": "Browser settings are not a valid withdrawal mechanism" },
      { "id": 13, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Does it explicitly state that non-essential cookies are only installed after consent?", "verdict": "No", "evidence": "Cookies are set immediately upon arrival.", "notes": "Critical violation" },
      { "id": 14, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Is the lifespan of cookies specified?", "verdict": "Yes", "evidence": "Analytics cookies last for 2 years.", "notes": "Specified" },
      { "id": 15, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Are social media pixels/trackers disclosed?", "verdict": "Yes", "evidence": "Facebook Pixel is used for retargeting.", "notes": "Disclosed" },
      { "id": 16, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Is data transfer to third countries disclosed?", "verdict": "Yes", "evidence": "Data may be transferred to US servers.", "notes": "Standard clause" },
      { "id": 17, "category": "PART B: COOKIES & TRACKING TRANSPARENCY", "question": "Is there a link to the privacy policy regarding cookie data?", "verdict": "Yes", "evidence": "See our Privacy Policy for more details.", "notes": "Linked" }
    ],
    "scorecard": {
      "total_score": 26,
      "max_score": 34,
      "compliance_level": "Moderate Risk",
      "risk_icon": "🟡",
      "priority_actions": [
        "Non-essential cookies being set before consent - critical GDPR violation",
        "Implement proper consent banner with granular controls",
        "Add retention period specifications for all data categories"
      ]
    }
  },
  "cookies": [
    { "name": "_ga", "domain": ".example.com", "category": "analytics", "set_before_consent": true, "is_third_party": false },
    { "name": "_gid", "domain": ".example.com", "category": "analytics", "set_before_consent": true, "is_third_party": false },
    { "name": "session_id", "domain": ".example.com", "category": "essential", "set_before_consent": true, "is_third_party": false },
    { "name": "_gcl_au", "domain": ".example.com", "category": "advertising", "set_before_consent": true, "is_third_party": false },
    { "name": "preferences", "domain": ".example.com", "category": "other", "set_before_consent": false, "is_third_party": false }
  ],
  "cookie_count": 5,
  "cookies_set_before_consent": 4,
  "non_essential_before_consent": 3
};

function App() {
  const [domain, setDomain] = useState('https://www.elmundo.es');
  const [auditData, setAuditData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, loading, complete, error
  const [statusMessage, setStatusMessage] = useState({ title: '', message: '', icon: '' });
  const [error, setError] = useState('');

  const extractDomain = (input) => {
    let d = input.replace(/^https?:\/\//, '');
    d = d.replace(/\/$/, '');
    d = d.split('/')[0];
    return d;
  };

  const startAudit = async () => {
    if (!domain.trim()) {
      showError('Please enter a website URL');
      return;
    }

    const domainName = extractDomain(domain);

    setAuditData(null);
    setError('');
    setStatus('loading');
    updateStatus('Processing...', 'Initializing audit...', '⏳');

    // Simulate progress for UX
    const progressSteps = [
      { t: 500, m: 'Analyzing cookies...' },
      { t: 1500, m: 'Checking policies...' },
      { t: 2500, m: 'Generating report...' }
    ];

    let cancel = false;
    // Simple progress simulation (visual only, real wait is fetch)

    try {
      const response = await fetch(`${API_BASE_URL}/scan/${encodeURIComponent(domainName)}`);

      if (!response.ok) {
        const errData = await response.json();
        if (errData.found === false) {
          throw new Error(
            `No scan results found for "${domainName}".\n\n` +
            `To scan this website:\n` +
            `1. Add the domain to app/domains.txt\n` +
            `2. Run: ./gradlew :app:run\n` +
            `3. Wait for scan to complete\n` +
            `4. Refresh this page and search again`
          );
        }
        throw new Error(errData.message || errData.error || 'Failed to load scan results');
      }

      const jsonResponse = await response.json();

      let data = jsonResponse;

      // Adapter for Node Backend Structure
      // Maps backend response format to frontend state structure

      // Check for either 'audit_checklist' (legacy/demo) or 'checklist' (backend)
      const checklistData = jsonResponse.data?.audit_checklist || jsonResponse.data?.checklist;

      if (jsonResponse.data && checklistData) {
        // Normalize the data structure for the view
        const analysisData = { ...jsonResponse.data };
        if (!analysisData.audit_checklist && analysisData.checklist) {
          analysisData.audit_checklist = analysisData.checklist;
        }

        data = {
          found: true,
          domain: jsonResponse.hostname,
          compliance_score: jsonResponse.data.scorecard?.total_score || 0,
          compliance_level: jsonResponse.data.scorecard?.compliance_level || 'Unknown',
          gdpr_analysis: analysisData,
          cookies: jsonResponse.data.cookies || [],
          cookies_set_before_consent: jsonResponse.data.cookies_set_before_consent || 0,
          non_essential_before_consent: jsonResponse.data.non_essential_before_consent || 0
        };
      }

      if (!data.found && !checklistData && !jsonResponse.data) {
        throw new Error(`No scan results found for "${domainName}". Please scan this website first using the Java scanner.`);
      }

      updateStatus('Completed', 'Scan loaded successfully!', '✅');

      setTimeout(() => {
        if (!cancel) {
          setAuditData(data);
          setStatus('complete');
        }
      }, 500);

    } catch (err) {
      showError(err.message);
    }

    return () => { cancel = true; };
  };

  const showDemo = () => {
    setAuditData(null);
    setError('');
    setStatus('loading');
    updateStatus('Processing...', 'Loading demo data...', '⏳');

    setTimeout(() => {
      setAuditData(DEMO_DATA);
      setStatus('complete');
    }, 800);
  };

  const updateStatus = (title, message, icon) => {
    setStatusMessage({ title, message, icon });
  };

  const showError = (msg) => {
    setError(msg);
    setStatus('error');
  };

  const downloadReport = () => {
    if (!auditData) return;
    const jsonStr = JSON.stringify(auditData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = extractDomain(auditData.domain || 'unknown');
    a.download = `gdpr-audit-${d}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <header>
        <div className="logo-container">
          <img src="/logo.png" alt="GDPR Auditor Logo" className="app-logo" />
        </div>
        <div className="header-text">
          <h1>Automated GDPR Cookie Compliance & ePrivacy Auditor</h1>
        </div>
      </header>

      <div className="main-content">
        <div className="input-section">
          <div className="input-group">
            <label htmlFor="domainInput">Website URL</label>
            <input
              type="text"
              id="domainInput"
              placeholder="https://www.example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                id="startAuditBtn"
                className="btn-primary"
                onClick={startAudit}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Loading...' : 'Start Audit'}
              </button>
              <button
                id="demoBtn"
                className="btn-secondary"
                onClick={showDemo}
                disabled={status === 'loading'}
              >
                View Demo
              </button>
            </div>
          </div>
        </div>

        {status === 'loading' && (
          <div className="status-section">
            <div className="status-card">
              <div className="status-header">
                <span className="status-icon">{statusMessage.icon}</span>
                <h2>{statusMessage.title}</h2>
              </div>
              <p className="status-message">{statusMessage.message}</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        )}

        {status === 'complete' && auditData && (
          <ResultsView data={auditData} onDownload={downloadReport} />
        )}

        {status === 'error' && (
          <div className="error-section">
            <div className="error-card">
              <span className="error-icon">❌</span>
              <h3>Error</h3>
              <p id="errorMessage">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsView({ data, onDownload }) {
  const gdpr = data.gdpr_analysis || {};
  const scorecard = gdpr.scorecard || {};
  const checklist = gdpr.audit_checklist || [];
  const complianceScore = data.compliance_score || 0;

  // Risk Icon Logic
  const getRiskIcon = (score) => {
    if (score >= 31) return '🟢';
    if (score >= 25) return '🟡';
    if (score >= 16) return '🟠';
    return '🔴';
  };
  const riskIcon = scorecard.risk_icon || getRiskIcon(complianceScore);

  // Sub-scores
  const partAItems = checklist.filter(item => item.category && item.category.includes('PART A'));
  const partAScore = partAItems.reduce((sum, item) => (item.verdict === 'Yes' ? sum + 2 : item.verdict === 'Partial' ? sum + 1 : sum), 0);
  const partAMax = partAItems.length * 2;

  const partBItems = checklist.filter(item => item.category && item.category.includes('PART B'));
  const partBScore = partBItems.reduce((sum, item) => (item.verdict === 'Yes' ? sum + 2 : item.verdict === 'Partial' ? sum + 1 : sum), 0);

  const partBMax = partBItems.length * 2;

  const isApiQueue = checklist.length === 0;

  return (
    <div className="results-section">
      <div className="results-header">
        <h2>Audit Results</h2>
        <button className="btn-secondary" onClick={onDownload}>Download Report</button>
      </div>

      <div className="scorecard">
        <div className="score-display">
          <div className="score-main">
            <span id="scoreValue">{complianceScore}</span>
            <span className="score-max">/ 34</span>
          </div>
          <div className="score-info">
            <h3>{data.compliance_level || 'Unknown'}</h3>
            <span className="risk-icon">{riskIcon}</span>
          </div>
        </div>

        <div className="score-divider"></div>

        <div className="score-details-container">
          <div className="score-detail-box">
            <div className="score-detail-icon">📄</div>
            <div className="score-detail-text">
              <span className="score-detail-label">Policy Score</span>
              <span className="score-detail-value">
                {isApiQueue ? <span style={{ fontSize: '0.8em' }}>API Queue</span> : `${partAScore} / ${partAMax}`}
              </span>
            </div>
          </div>
          <div className="score-detail-box">
            <div className="score-detail-icon">🍪</div>
            <div className="score-detail-text">
              <span className="score-detail-label">Cookies Score</span>
              <span className="score-detail-value">
                {isApiQueue ? <span style={{ fontSize: '0.8em' }}>API Queue</span> : `${partBScore} / ${partBMax}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <CookieStats data={data} />

      {checklist.length > 0 ? (
        <>
          <div className="diagram-section">
            <h3>Compliance Overview</h3>
            <ComplianceDiagram checklist={checklist} />
          </div>

          <div className="top-questions-section">
            <h3>Key Compliance Indicators</h3>
            <TopQuestions checklist={checklist} />
          </div>

          <div className="checklist-section">
            <h3>Compliance Checklist</h3>
            <Checklist checklist={checklist} />
          </div>

          <div className="priority-actions-section">
            <h3>Priority Actions</h3>
            <ul className="priority-actions">
              {(scorecard.priority_actions || []).map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="diagram-section">
          <div className="info-message">
            <p><strong>Note:</strong> Policy analysis is unavailable. This scan was created with minimal analysis due to API quota limits.</p>
            <p>Cookie compliance information is shown above.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CookieStats({ data }) {
  const cookies = data.cookies || [];
  const cookiesBeforeConsent = data.cookies_set_before_consent || 0;
  const nonEssentialBeforeConsent = data.non_essential_before_consent || 0;

  const categories = {};
  cookies.forEach(c => {
    const cat = c.category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const categoryIcons = {
    'essential': '🔒',
    'analytics': '📊',
    'advertising': '📢',
    'other': '📦'
  };

  return (
    <div className="cookie-stats-section">
      <h3>Cookie Analysis</h3>
      <div className="cookie-stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🍪</div>
          <div className="stat-value">{cookies.length}</div>
          <div className="stat-label">Total Cookies</div>
        </div>
        <div className={`stat-card ${cookiesBeforeConsent > 0 ? 'stat-warning' : ''}`}>
          <div className="stat-icon">⚠️</div>
          <div className="stat-value">{cookiesBeforeConsent}</div>
          <div className="stat-label">Set Before Consent</div>
        </div>
        <div className={`stat-card ${nonEssentialBeforeConsent > 0 ? 'stat-danger' : ''}`}>
          <div className="stat-icon">🔴</div>
          <div className="stat-value">{nonEssentialBeforeConsent}</div>
          <div className="stat-label">Non-Essential Before Consent</div>
        </div>
      </div>

      <div className="cookie-categories-section">
        <h4>Cookie Categories</h4>
        <div className="category-list">
          {Object.entries(categories).map(([cat, count]) => (
            <div key={cat} className="category-item">
              <span className="category-icon">{categoryIcons[cat] || '📦'}</span>
              <span className="category-name">{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
              <span className="category-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cookie-list-section">
        <h4>Cookie Details</h4>
        <div className="cookie-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Domain</th>
                <th>Category</th>
                <th>Before Consent</th>
                <th>Third Party</th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((cookie, idx) => (
                <tr key={idx} className={cookie.set_before_consent && cookie.category !== 'essential' ? 'violation-row' : ''}>
                  <td><code>{cookie.name}</code></td>
                  <td>{cookie.domain}</td>
                  <td><span className={`category-badge category-${cookie.category}`}>{cookie.category}</span></td>
                  <td>{cookie.set_before_consent ? '❌ Yes' : '✅ No'}</td>
                  <td>{cookie.is_third_party ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



function ComplianceDiagram({ checklist }) {
  const total = checklist.length;
  const yesCount = checklist.filter(x => x.verdict === 'Yes').length;
  const partialCount = checklist.filter(x => x.verdict === 'Partial').length;
  const noCount = checklist.filter(x => x.verdict === 'No').length;

  const partA = checklist.filter(item => item.category && item.category.includes('PART A'));
  const partB = checklist.filter(item => item.category && item.category.includes('PART B'));

  const partAYes = partA.filter(x => x.verdict === 'Yes').length;
  const partBYes = partB.filter(x => x.verdict === 'Yes').length;

  const yesPercent = Math.round((yesCount / total) * 100) || 0;
  const partAPercent = partA.length > 0 ? Math.round((partAYes / partA.length) * 100) : 0;
  const partBPercent = partB.length > 0 ? Math.round((partBYes / partB.length) * 100) : 0;

  return (
    <div className="compliance-diagram">
      <div className="diagram-hierarchy">
        <div className="diagram-level-1">
          <div className="diagram-label-main">Overall Compliance</div>
          <div className="diagram-bar-container">
            <div className="diagram-bar" style={{ width: `${yesPercent}%` }}>{yesPercent}%</div>
          </div>
          <div className="diagram-value">{yesCount}/{total}</div>
        </div>

        <div className="diagram-level-2">
          <div className="diagram-sub-level">
            <div className="diagram-label-sub">Part A: Governance</div>
            <div className="diagram-bar-container">
              <div className="diagram-bar" style={{ width: `${partAPercent}%` }}>{partAPercent}%</div>
            </div>
            <div className="diagram-value">{partAYes}/{partA.length}</div>
          </div>
          <div className="diagram-sub-level">
            <div className="diagram-label-sub">Part B: Cookies</div>
            <div className="diagram-bar-container">
              <div className="diagram-bar" style={{ width: `${partBPercent}%` }}>{partBPercent}%</div>
            </div>
            <div className="diagram-value">{partBYes}/{partB.length}</div>
          </div>
        </div>
      </div>

      <div className="pie-chart-section">
        <div className="pie-chart-label">Verdict Distribution</div>
        <div className="pie-chart-container">
          <div className="pie-chart-visual">
            <PieChart yes={yesCount} partial={partialCount} no={noCount} />
          </div>
          <div className="verdict-distribution">
            <div className="verdict-item verdict-yes">
              <span className="verdict-color"></span>
              <div className="verdict-text">
                <strong>Yes</strong>
                <span>{yesCount} ({Math.round((yesCount / total) * 100)}%)</span>
              </div>
            </div>
            <div className="verdict-item verdict-partial">
              <span className="verdict-color"></span>
              <div className="verdict-text">
                <strong>Partial</strong>
                <span>{partialCount} ({Math.round((partialCount / total) * 100)}%)</span>
              </div>
            </div>
            <div className="verdict-item verdict-no">
              <span className="verdict-color"></span>
              <div className="verdict-text">
                <strong>No</strong>
                <span>{noCount} ({Math.round((noCount / total) * 100)}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PieChart({ yes, partial, no }) {
  const total = yes + partial + no;
  if (total === 0) return null;

  const toRadians = (deg) => deg * Math.PI / 180;
  const createArc = (startAngle, endAngle) => {
    const radius = 50;
    const centerX = 60;
    const centerY = 60;
    const start = {
      x: centerX + radius * Math.cos(toRadians(startAngle - 90)),
      y: centerY + radius * Math.sin(toRadians(startAngle - 90))
    };
    const end = {
      x: centerX + radius * Math.cos(toRadians(endAngle - 90)),
      y: centerY + radius * Math.sin(toRadians(endAngle - 90))
    };
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  };

  const yesAngle = (yes / total) * 360;
  const partialAngle = (partial / total) * 360;
  const noAngle = (no / total) * 360;

  let current = 0;
  const yesStart = current; current += yesAngle; const yesEnd = current;
  const partialStart = current; current += partialAngle; const partialEnd = current;
  const noStart = current; current += noAngle; const noEnd = current;

  return (
    <svg viewBox="0 0 120 120" className="pie-chart-svg">
      {yes > 0 && <path d={createArc(yesStart, yesEnd)} fill="#28a745" stroke="#fff" strokeWidth="2" />}
      {partial > 0 && <path d={createArc(partialStart, partialEnd)} fill="#ffc107" stroke="#fff" strokeWidth="2" />}
      {no > 0 && <path d={createArc(noStart, noEnd)} fill="#dc3545" stroke="#fff" strokeWidth="2" />}
    </svg>
  );
}

function TopQuestions({ checklist }) {
  const importantIds = [1, 13, 3];
  const top = importantIds.map(id => checklist.find(i => i.id === id)).filter(Boolean);

  if (top.length === 0) return null;

  return (
    <div className="top-questions-container">
      {top.map((item, idx) => (
        <div key={item.id} className="top-question-card">
          <div className="top-question-header">
            <div className="top-question-number">{idx + 1}</div>
            <div className="top-question-text">{item.question}</div>
          </div>
          <div className={`top-question-verdict verdict-${item.verdict.toLowerCase()}`}>
            {item.verdict}
          </div>
          {item.evidence && (
            <div className="top-question-evidence">
              <strong>Evidence:</strong> "{item.evidence.length > 150 ? item.evidence.substring(0, 150) + '...' : item.evidence}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Checklist({ checklist }) {
  const partA = checklist.filter(item => item.category && item.category.includes('PART A'));
  const partB = checklist.filter(item => item.category && item.category.includes('PART B'));

  return (
    <div className="checklist-container">
      {partA.length > 0 && (
        <>
          <div className="checklist-section-header">
            <h4>PART A: General Governance & Data Subject Rights</h4>
          </div>
          {partA.map(item => <ChecklistItem key={item.id} item={item} />)}
        </>
      )}
      {partB.length > 0 && (
        <>
          <div className="checklist-section-header">
            <h4>PART B: Cookies & Tracking Transparency</h4>
          </div>
          {partB.map(item => <ChecklistItem key={item.id} item={item} />)}
        </>
      )}
    </div>
  );
}

function ChecklistItem({ item }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`checklist-item ${expanded ? 'expanded' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="checklist-item-header">
        <span className="checklist-item-question">
          {item.id}. {item.question}
        </span>
        <span className={`verdict-badge verdict-${item.verdict.toLowerCase()}`}>{item.verdict}</span>
      </div>
      <div className={`checklist-item-details ${expanded ? 'show' : ''}`}>
        <div className="category"><strong>Category:</strong> {item.category}</div>
        {item.evidence && <div className="evidence"><strong>Evidence:</strong> "{item.evidence}"</div>}
        {item.notes && <div className="notes"><strong>Notes:</strong> {item.notes}</div>}
      </div>
    </div>
  );
}

export default App;
