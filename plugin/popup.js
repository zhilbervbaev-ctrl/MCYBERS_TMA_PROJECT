document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE_URL = 'http://localhost:3000/api';

    const domainDisplay = document.getElementById('domainDisplay');
    const scoreValue = document.getElementById('scoreValue');
    const riskIcon = document.getElementById('riskIcon');
    const complianceLevel = document.getElementById('complianceLevel');
    const policyScore = document.getElementById('policyScore');
    const cookieScore = document.getElementById('cookieScore');
    const totalCookies = document.getElementById('totalCookies');
    const beforeConsent = document.getElementById('beforeConsent');
    const nonEssential = document.getElementById('nonEssential');
    const recommendationsList = document.getElementById('recommendationsList');
    const errorDisplay = document.getElementById('errorDisplay');
    const viewReportBtn = document.getElementById('viewReportBtn');

    // Helper to extract domain
    const extractDomain = (url) => {
        try {
            const u = new URL(url);
            return u.hostname;
        } catch (e) {
            return null;
        }
    };

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
        showError("Cannot access current tab URL.");
        return;
    }

    const domain = extractDomain(tab.url);
    domainDisplay.textContent = domain || 'Unknown Domain';

    if (!domain) {
        showError("Invalid domain.");
        return;
    }

    viewReportBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: `http://localhost:5173/?domain=${encodeURIComponent(domain)}` });
    });

    try {
        const response = await fetch(`${API_BASE_URL}/scan/${encodeURIComponent(domain)}`);

        if (!response.ok) {
            const err = await response.json();
            if (err.found === false) {
                showError("No scan data found for this domain. Please run the scanner first.");
                return;
            }
            throw new Error("Failed to fetch scan results.");
        }

        const json = await response.json();
        updateUI(json);

    } catch (err) {
        showError(`Error: ${err.message}`);
        console.error(err);
    }

    function showError(msg) {
        errorDisplay.textContent = msg;
        errorDisplay.classList.remove('hidden');
        document.getElementById('mainContent').style.opacity = '0.5';
        document.getElementById('mainContent').style.pointerEvents = 'none';
    }

    function updateUI(data) {
        // Adapter logic similar to Frontend
        const checklist = data.data?.audit_checklist || data.data?.checklist || [];
        const scorecard = data.data?.scorecard || {};
        const cookiesItems = data.data?.cookies || [];

        const gdprData = {
            compliance_score: scorecard.total_score || 0,
            compliance_level: scorecard.compliance_level || 'Unknown',
            risk_icon: scorecard.risk_icon || '⚪',
            checklist: checklist,
            priority_actions: scorecard.priority_actions || [],
            cookies_count: cookiesItems.length,
            cookies_before_consent: data.data?.cookies_set_before_consent || 0,
            non_essential_before_consent: data.data?.non_essential_before_consent || 0
        };

        // Calculate sub-scores if not provided directly
        const partAItems = checklist.filter(item => item.category && item.category.includes('PART A'));
        const partAScore = partAItems.reduce((sum, item) => (item.verdict === 'Yes' ? sum + 2 : item.verdict === 'Partial' ? sum + 1 : sum), 0);
        const partAMax = partAItems.length * 2 || 12; // Fallback max

        const partBItems = checklist.filter(item => item.category && item.category.includes('PART B'));
        const partBScore = partBItems.reduce((sum, item) => (item.verdict === 'Yes' ? sum + 2 : item.verdict === 'Partial' ? sum + 1 : sum), 0);
        const partBMax = partBItems.length * 2 || 22; // Fallback max

        // DOM Updates
        scoreValue.textContent = gdprData.compliance_score;
        riskIcon.textContent = gdprData.risk_icon;
        complianceLevel.textContent = gdprData.compliance_level;

        policyScore.textContent = `${partAScore} / ${partAMax}`;
        cookieScore.textContent = `${partBScore} / ${partBMax}`;

        totalCookies.textContent = gdprData.cookies_count;
        beforeConsent.textContent = gdprData.cookies_before_consent;
        nonEssential.textContent = gdprData.non_essential_before_consent;

        // Recommendations
        recommendationsList.innerHTML = '';
        if (gdprData.priority_actions.length > 0) {
            gdprData.priority_actions.slice(0, 3).forEach(action => {
                const li = document.createElement('li');
                li.textContent = action;
                recommendationsList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = "No critical recommendations found. Good job!";
            recommendationsList.appendChild(li);
        }
    }
});
