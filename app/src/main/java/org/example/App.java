/*
 * Main application entry point for the GDPR Compliance Auditor.
 */
package org.example;

import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import com.google.genai.Client;
import com.google.genai.types.GenerateContentResponse;
import java.util.regex.*;
import java.util.*;
import java.net.*;
import java.time.Duration;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.devtools.DevTools;
import org.openqa.selenium.devtools.HasDevTools;
import org.openqa.selenium.devtools.NetworkInterceptor;
import org.openqa.selenium.devtools.v141.browser.Browser;
import org.openqa.selenium.devtools.v141.network.Network;
import org.openqa.selenium.devtools.v141.performance.Performance;
import org.openqa.selenium.devtools.v141.performance.model.Metric;
import org.openqa.selenium.remote.http.*;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.chromium.HasCdp;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.ResultSet;


public class App {

    // Keywords for cookie policy URLs (multiple EU languages)
    private static final List<String> COOKIE_KEYWORDS = Arrays.asList(
        // Español
        "cookies", "cookie", "politica-de-cookies", "política-de-cookies",
        // Inglés
        "cookie-policy", "cookies-policy",
        // Francés
        "politique-de-cookies", "cookies-et-traceurs",
        // Alemán
        "cookie-richtlinie",
        // Italiano
        "cookie-policy", "informativa-cookie",
        // Portugués
        "politica-de-cookies", "política-de-cookies"
    );

    // Keywords for privacy policy / data protection URLs (multiple EU languages)
    private static final List<String> PRIVACY_KEYWORDS = Arrays.asList(
        // Español
        "privacidad", "politica-de-privacidad", "política-de-privacidad", "proteccion-de-datos",
        // Inglés
        "privacy", "privacy-policy", "data-protection",
        // Francés
        "confidentialite", "politique-de-confidentialite", "donnees-personnelles",
        // Alemán
        "datenschutz", "datenschutzerklarung",
        // Italiano
        "privacy", "informativa-privacy", "protezione-dei-dati",
        // Portugués
        "privacidade", "politica-de-privacidade",
        // Neerlandés
        "privacyverklaring", "gegevensbescherming",
        // Sueco
        "integritet", "personuppgifter"
    );

    private static final String URL = "jdbc:mysql://127.0.0.1:3306/TMA?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
    private static final String USER = "root";

    public static void main(String[] args) throws Exception {

        String geminiApiKey = System.getenv("GEMINI_API_KEY");
        String chromedriverAbsolutePath = System.getenv("CHROMEDRIVER_ABSOLUTE_PATH");
        String databasePassword = System.getenv("DATABASE_PASSWORD");

        if (geminiApiKey == null) {
            System.out.println("Environment variable GEMINI_API_KEY has not been exported. It is not possible to proceed.\nTo set it use this command 'export GEMINI_API_KEY=<key>'");
            return;
        }

        if (chromedriverAbsolutePath == null) {
            System.out.println("Environment variable CHROMEDRIVER_ABSOLUTE_PATH has not been exported. It is not possible to proceed.\nTo set it use this command 'export CHROMEDRIVER_ABSOLUTE_PATH=<absolute_path>'");
            return;
        }

        if (databasePassword == null) {
            System.out.println("Environment variable DATABASE_PASSWORD has not been exported. It is not possible to proceed.\nTo set it use this command 'export DATABASE_PASSWORD=<database_password>'");
            return;
        }

        // Read domains from a file (one URL per line, # for comments)
        List<String> domains = Files.readAllLines(Path.of("domains.txt"), StandardCharsets.UTF_8)
                .stream()
                .map(String::trim)
                .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                .toList();

        if (domains.isEmpty()) {
            System.out.println("No domains found in domains.txt. Please add at least one URL.");
            return;
        }

        System.setProperty("webdriver.chrome.driver", chromedriverAbsolutePath);

        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless=new");
        options.addArguments("--disable-gpu");
        options.addArguments("--window-size=1920,1080");
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");

        WebDriver driver = new ChromeDriver(options);

        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));

        CopyOnWriteArrayList<Contents.Supplier> content = new CopyOnWriteArrayList<>();

        Filter myFilter = next -> {
            return req -> {
                HttpResponse res = next.execute(req);
                //if (res.getHeader("Content-Length") != null && Integer.parseInt(res.getHeader("Content-Length")) != 0) {
                    content.add(res.getContent());
                //}
                return res;
            };
        };

        NetworkInterceptor ignored = new NetworkInterceptor(driver, myFilter);

        Client client = new Client();

        // Loop over all domains from domains.txt
        for (String domain : domains) {

            System.out.println("\n\n========================================");
            System.out.println("Processing domain: " + domain);
            System.out.println("========================================\n");

            System.out.println("Checking database for domain: " + domain);

            // Check if this domain was already processed
            boolean alreadyProcessed = false;

            try (Connection connection = DriverManager.getConnection(URL, USER, databasePassword)) {

                String checkQuery = "SELECT 1 FROM host_results WHERE hostname = ? LIMIT 1";
                try (PreparedStatement checkStmt = connection.prepareStatement(checkQuery)) {
                    checkStmt.setString(1, domain);
                    try (ResultSet rs = checkStmt.executeQuery()) {
                        if (rs.next()) {
                            alreadyProcessed = true;
                        }
                    }
                }

            } catch (SQLException e) {
                System.err.println("Database error while checking existing domain: " + domain);
                e.printStackTrace();
                continue;
            }

            if (alreadyProcessed) {
                System.out.println("Domain FOUND in database, skipping processing: " + domain);
                continue;
            }

            System.out.println("Domain NOT found in database, proceeding with analysis: " + domain);

            // Clear cookies and storage to ensure a clean session for this domain
            try {
                driver.manage().deleteAllCookies();
                ((org.openqa.selenium.JavascriptExecutor) driver).executeScript(
                    "window.localStorage.clear(); window.sessionStorage.clear();");
            } catch (Exception e) {
                System.out.println("Warning: Could not clear updated browser state: " + e.getMessage());
            }


            // Clear previous captured contents
            content.clear();

            URI uri;
            try {
                uri = new URI(domain);
            } catch (URISyntaxException e) {
                System.out.println("Skipping invalid domain (URI syntax error): " + domain);
                continue;
            }

            String host = uri.getHost(); // e.g. "www.elmundo.es"
            if (host == null) {
                System.out.println("Skipping invalid domain (no host found): " + domain);
                continue;
            }

            String domain_without_protocol = host + "/";
            String short_domain = host.startsWith("www.") ? host.substring(4) : host;

            // Navigate to the domain
            driver.get(domain);

            try {
                wait.until(_d -> content.size() > 150);
            } catch (org.openqa.selenium.TimeoutException e) {
                System.out.println("\nTimeout while waiting for network activity on: " + domain);
                System.out.println("Number of caught files: " + content.size());
            }

            // Cookie capture & consent automation
            List<CookieData> cookiesBefore = getCookies(driver);
            System.out.println("Cookies captured BEFORE consent: " + cookiesBefore.size());

            detectAndClickConsent(driver);
            
            List<CookieData> cookiesAfter = getCookies(driver);
            System.out.println("Cookies captured AFTER consent: " + cookiesAfter.size());

            StringBuilder cookieInventoryBuilder = new StringBuilder();
            cookieInventoryBuilder.append("=== COOKIES SET BEFORE CONSENT (VIOLATIONS) ===\n");
            cookieInventoryBuilder.append("Total Count: ").append(cookiesBefore.size()).append("\n");
            cookieInventoryBuilder.append("These cookies were detected BEFORE the user clicked any consent button.\n");
            cookieInventoryBuilder.append("For the JSON output, mark these with \"set_before_consent\": true\n\n");
            for(CookieData c : cookiesBefore) {
                cookieInventoryBuilder.append("- ").append(c.toString()).append("\n");
            }
            
            cookieInventoryBuilder.append("\n=== COOKIES SET AFTER CONSENT (COMPLIANT) ===\n");
            cookieInventoryBuilder.append("Total Count: ").append(cookiesAfter.size()).append("\n");
            cookieInventoryBuilder.append("These cookies were detected AFTER the user clicked the consent button.\n");
            cookieInventoryBuilder.append("For the JSON output, mark NEW cookies (not in the above list) with \"set_before_consent\": false\n\n");
            for(CookieData c : cookiesAfter) {
                // Check if this cookie was already present before
                boolean presentBefore = false;
                for(CookieData b : cookiesBefore) {
                    if(b.name.equals(c.name) && b.domain.equals(c.domain)) {
                        presentBefore = true;
                        break;
                    }
                }
                if (!presentBefore) {
                     cookieInventoryBuilder.append("- ").append(c.toString()).append(" (NEW - triggered by consent)\n");
                }
            }

            String finalCookieInventory = cookieInventoryBuilder.toString();

            // ------------------------------------------------

            List<String> urls = new ArrayList<>();

            for (int i = 0; i < content.size(); i++) {
                String result = new String(content.get(i).get().readAllBytes());

                // Regex to match https:// followed by any non-space characters
                String regex = "https://[^\\s]+";

                Pattern pattern = Pattern.compile(regex);
                Matcher matcher = pattern.matcher(result);

                while (matcher.find()) {
                    urls.add(matcher.group());
                }
            }

            String cookieUrlsSeparatedByCommas = "";
            String privacyUrlsSeparatedByCommas = "";

            // Filter and build URL list for cookies/privacy on this domain
            for (String url : urls) {

                String[] cuttedUrl = url.split("[\"'\\\\]");
                String normalizedUrl = cuttedUrl[0].toLowerCase();

                // Only consider URLs from this domain
                if (normalizedUrl.contains(short_domain)) {

                    boolean isCookie = false;
                    for (String keyword : COOKIE_KEYWORDS) {
                        if (normalizedUrl.contains(keyword)) {
                            isCookie = true;
                            break;
                        }
                    }

                    boolean isPrivacy = false;
                    for (String keyword : PRIVACY_KEYWORDS) {
                        if (normalizedUrl.contains(keyword)) {
                            isPrivacy = true;
                            break;
                        }
                    }

                    if (isCookie) {
                        cookieUrlsSeparatedByCommas = cookieUrlsSeparatedByCommas + cuttedUrl[0] + ", ";
                    }

                    if (isPrivacy) {
                        privacyUrlsSeparatedByCommas = privacyUrlsSeparatedByCommas + cuttedUrl[0] + ", ";
                    }
                }
            }

            // Debug:
            System.out.println("Cookie candidates for " + domain + ": " + cookieUrlsSeparatedByCommas);
            System.out.println("Privacy candidates for " + domain + ": " + privacyUrlsSeparatedByCommas);

            if (cookieUrlsSeparatedByCommas.isEmpty() && privacyUrlsSeparatedByCommas.isEmpty()) {
                System.out.println("No candidate URLs for cookies or privacy on domain: " + domain);
                continue; // pasa al siguiente dominio del for grande
            }
            if (!cookieUrlsSeparatedByCommas.isEmpty()) {
                cookieUrlsSeparatedByCommas =
                        cookieUrlsSeparatedByCommas.substring(0, cookieUrlsSeparatedByCommas.length() - 2);
            }
            if (!privacyUrlsSeparatedByCommas.isEmpty()) {
                privacyUrlsSeparatedByCommas =
                        privacyUrlsSeparatedByCommas.substring(0, privacyUrlsSeparatedByCommas.length() - 2);
            }
            ////////////////////////////////////////////////////////////

            // Heuristic URL Selection (Bypassing Gemini for URL identification)
            
            String targetCookieUrl = "";
            String targetPrivacyUrl = "";
            
            if (!cookieUrlsSeparatedByCommas.isEmpty()) {
                targetCookieUrl = cookieUrlsSeparatedByCommas.split(",")[0].trim();
            } else if (!privacyUrlsSeparatedByCommas.isEmpty()) {
                 // Fallback
                 targetCookieUrl = privacyUrlsSeparatedByCommas.split(",")[0].trim();
            }
            
            if (!privacyUrlsSeparatedByCommas.isEmpty()) {
                 targetPrivacyUrl = privacyUrlsSeparatedByCommas.split(",")[0].trim();
            } else if (!cookieUrlsSeparatedByCommas.isEmpty()) {
                // Fallback
                targetPrivacyUrl = cookieUrlsSeparatedByCommas.split(",")[0].trim();
            }
            
            // Hardcode fallback if absolutely nothing found (though the loop 'continue' above should prevent this)
            if (targetCookieUrl.isEmpty()) targetCookieUrl = "https://" + short_domain;
            if (targetPrivacyUrl.isEmpty()) targetPrivacyUrl = "https://" + short_domain;

            String privacyHtml = "";
            String cookiesHtml = "";

            try {
                System.out.println("Fetching content directly from URL: " + targetCookieUrl);
                cookiesHtml = fetchContent(targetCookieUrl);
                
                System.out.println("Fetching content directly from URL: " + targetPrivacyUrl);
                privacyHtml = fetchContent(targetPrivacyUrl);

                if (cookiesHtml.isEmpty()) System.out.println("WARNING: Fetched cookies content is empty.");
                if (privacyHtml.isEmpty()) System.out.println("WARNING: Fetched privacy content is empty.");


            } catch (Exception e) {
                System.err.println("Error fetching policy content: " + e.getMessage());
                e.printStackTrace();
            }


            String promptArray[] = new String[3];

            promptArray[0] = """

            Role: Act as a Senior GDPR and ePrivacy Compliance Auditor.

            Task: You will analyze the content of two provided legal documents in HTML format (Privacy Policy and Cookie Policy) against a specific compliance checklist and output the results in a strict JSON format.

            Input Data:
            
            """;

            promptArray[1] =
                    "\nPrivacy Policy HTML file: [" + privacyHtml + "]" +
                    "\nCookie Policy HTML file: [" + cookiesHtml + "]" +
                    "\nPrivacy Policy HTML file: [" + privacyHtml + "]" +
                    "\nCookie Policy HTML file: [" + cookiesHtml + "]" +
                    "\n\nTECHNICAL COOKIE SCAN RESULTS (Real-time data from browser):\n" + finalCookieInventory;

            promptArray[2] = """

            Instructions:

            Read and analyze the content of the documents provided above.

            Evaluate the "Audit Checklist" questions below.

            CRITICAL INSTRUCTIONS FOR VERDICT & SCORING (MUST FOLLOW EXACTLY):
            
            PART 1: COOKIE TECHNICAL VIOLATIONS (STRICT ENFORCEMENT):
            1. You MUST cross-reference the "TECHNICAL COOKIE SCAN RESULTS" with the policy text.
            2. For question 13 (non-essential cookies only after consent): If the Technical Scan shows cookies set BEFORE consent, the Verdict MUST be "No" regardless of policy claims.
            3. If "cookies_set_before_consent" > 0, the overall "compliance_level" cannot be "Low Risk" (31-34).
            
            PART 2: POLICY EVALUATION (NUANCED ASSESSMENT):
            For all other questions (1-12, 14-17), use nuanced evaluation:
            - "Yes" = Requirement is fully met with clear, comprehensive information
            - "Partial" = Requirement is partially met (e.g., some rights listed but not all, retention mentioned generally but not specifically, cookie policy exists but lacks detail)
            - "No" = Requirement is not met or information is absent
            
            SCORING: Calculate the score internally:
            Yes = 2 points
            Partial = 1 point
            No/Not Found = 0 points

            Total possible: 34 points.
            
            SCORING THRESHOLDS (MANDATORY - DO NOT DEVIATE - EXAMPLES PROVIDED):
            - Score 0-15: compliance_level = "Critical Risk", risk_icon = "🔴" (Example: score 10 → Critical Risk 🔴)
            - Score 16-24: compliance_level = "High Risk", risk_icon = "🟠" (Example: score 20 → High Risk 🟠)
            - Score 25-30: compliance_level = "Moderate Risk", risk_icon = "🟡" (Example: score 28 → Moderate Risk 🟡)
            - Score 31-34: compliance_level = "Low Risk", risk_icon = "🟢" (Example: score 32 → Low Risk 🟢)
            
            VERIFY your scoring calculation matches these thresholds before outputting JSON.

            AUDIT CHECKLIST (To be analyzed):

            PART A: GENERAL GOVERNANCE & DATA SUBJECT RIGHTS

            Does the policy clearly state the full contact details of the Data Controller (company name, address) and the Data Protection Officer (DPO), if applicable?

            Does the policy specify the retention period (how long data is kept) for the main categories of personal data collected?

            Does the policy list the specific user rights (Access, Rectification, Erasure, Objection, Portability)?

            Is there an operational contact channel (specific email or form) and clear instructions on how to exercise these rights?

            Is the right to lodge a complaint with the relevant supervisory authority mentioned?

            If data leaves the EEA, does the policy identify the recipient country and the specific safeguards used (e.g., Standard Contractual Clauses/SCCs or Data Privacy Framework)?

            PART B: COOKIES & TRACKING TRANSPARENCY 7. Is there a specific and accessible Cookie Policy? (Is it separate or clearly integrated within the Privacy Policy?) 8. Does it explain in plain language what cookies are and why they are used on this website? 9. Are cookie categories clearly defined? (e.g., Technical, Analytical, Marketing, Preferences). 10. Are "strictly necessary" cookies explained, and is it justified why these do not require prior consent? 11. Does the policy contain a table or list detailing every cookie, including: Name, Provider, Purpose, and Duration? 12. Are there links to the privacy policies of external providers (third parties like Google, Facebook)? 13. Does it explicitly state that non-essential cookies (analytics/marketing) are only installed after consent? 14. Is the legal basis identified for each cookie type? (e.g., "Legitimate Interest/Necessity" for essential ones; "Consent" for the rest). 15. Does the text explain how the user can withdraw or modify their consent at any time? (Must mention a settings panel, footer link, or similar). 16. Does it clarify that withdrawing consent is as easy as giving it (e.g., "you can change your mind at any time")? 17. Does it mention if cookies are used for user profiling or tracking?

            OUTPUT FORMAT (STRICT JSON)
            Provide the response ONLY as a valid JSON object. Do not include introductory text or markdown formatting (like ```json). Use exactly the following structure:

            JSON

            {
              "audit_meta": {
                "auditor_role": "Senior GDPR & ePrivacy Compliance Auditor",
                "documents_reviewed": [
                  "Privacy Policy",
                  "Cookie Policy",
                  "Technical Cookie Scan"
                ],
              },
              "audit_checklist": [
                {
                  "id": 1,
                  "category": "PART A: GENERAL GOVERNANCE & DATA SUBJECT RIGHTS",
                  "question": "Question text...",
                  "verdict": "Yes/No/Partial",
                  "evidence": "Quote from text...",
                  "notes": "Short explanation"
                }
              ],
              "cookies": [
                {
                   "name": "_ga",
                   "domain": ".example.com",
                   "category": "analytics/advertising/essential/other",
                   "set_before_consent": true/false,
                   "is_third_party": true/false
                }
                // ... (List ALL cookies found in the inventory)
              ],

              "cookies_set_before_consent": 0, // Count
              "non_essential_before_consent": 0, // Count of analytics/marketing cookies set before consent
              "scorecard": {
                "total_score": 0,
                "max_score": 34,
                "compliance_level": "Level",
                "risk_icon": "Icon",
                "priority_actions": []
              }
            }

            COOKIE CLASSIFICATION RULES (CRITICAL - FOLLOW EXACTLY):
            1. You MUST populate the "cookies" array by analyzing the "TECHNICAL COOKIE SCAN RESULTS" provided above.
            2. Assign a category to each cookie based on its name:
               - "_ga", "_gid", "_ga_*" → "analytics"
               - "_gcl_au", "_fbp", "xbc", "_pctx" → "advertising"
               - "FCNEC", "didomi_token", "ue_consentState" → "essential"
            3. COOKIE TIMING CLASSIFICATION (MOST IMPORTANT):
               - IF a cookie appears under "=== COOKIES SET BEFORE CONSENT (VIOLATIONS) ===":
                 → set "set_before_consent": true
               - IF a cookie appears under "=== COOKIES SET AFTER CONSENT (COMPLIANT) ===" and is marked "NEW":
                 → set "set_before_consent": false
            4. "cookies_set_before_consent" MUST equal the "Total Count" shown under "=== COOKIES SET BEFORE CONSENT (VIOLATIONS) ===".
            5. "non_essential_before_consent" MUST count only analytics/advertising/other cookies from the BEFORE CONSENT section (exclude essential cookies).
            
            EXAMPLE: If the scan shows:
            "=== COOKIES SET BEFORE CONSENT (VIOLATIONS) ==="
            "Total Count: 42"
            "- Name: _ga, Domain: .example.com"
            
            Then in your JSON output:
            {"name": "_ga", "domain": ".example.com", "category": "analytics", "set_before_consent": true, ...}
            And: "cookies_set_before_consent": 42
            """;

            GenerateContentResponse responseGDPR = client.models.generateContent(
                    "gemini-2.5-flash",
                    promptArray[0] + promptArray[1] + promptArray[2],
                    null);

            System.out.println();
            System.out.println("Gemini GDPR response for domain " + domain + ": " + responseGDPR.text());

            try (Connection connection = DriverManager.getConnection(URL, USER, databasePassword)) {

                String query = "INSERT INTO host_results (hostname, results) VALUES (?, ?)";
        
                PreparedStatement ps = null;
                ps = connection.prepareStatement(query);
                ps.setString(1, domain);
                ps.setString(2, responseGDPR.text());  
                //ps.execute();
                //instead of ps.execute, we want to verify if data is saved
                int rows = ps.executeUpdate();
                System.out.println("DB insert rows affected: " + rows + " for domain " + domain);

            } catch (SQLException e) {
                e.printStackTrace();
            }
        }

        driver.quit();
        Runtime.getRuntime().exec("rm -rf privacidad");
        Runtime.getRuntime().exec("rm -rf cookies");
    }


    // Helper classes & methods

    static class CookieData {
        String name;
        String domain;
        boolean isHttpOnly;
        boolean isSecure;
        String path;

        public CookieData(String name, String domain, boolean isHttpOnly, boolean isSecure, String path) {
            this.name = name;
            this.domain = domain;
            this.isHttpOnly = isHttpOnly;
            this.isSecure = isSecure;
            this.path = path;
        }

        @Override
        public String toString() {
            return "Name: " + name + ", Domain: " + domain;
        }
    }



    private static List<CookieData> getCookies(WebDriver driver) {
        Set<Cookie> cookies = driver.manage().getCookies();
        List<CookieData> list = new ArrayList<>();
        for (Cookie c : cookies) {
            list.add(new CookieData(c.getName(), c.getDomain(), c.isHttpOnly(), c.isSecure(), c.getPath()));
        }
        return list;
    }


    private static String fetchContent(String urlString) {
        try {
            // Handle if Gemini returns markdown link format e.g. [label](url) or just url
            // Simple cleanup
            if (urlString.startsWith("http")) {
                // ok
            } else {
                // try to find http...
                int httpIdx = urlString.indexOf("http");
                if (httpIdx >= 0) {
                   urlString = urlString.substring(httpIdx);
                   int endIdx = urlString.indexOf(" ");
                   if (endIdx > 0) urlString = urlString.substring(0, endIdx);
                   endIdx = urlString.indexOf(")");
                   if (endIdx > 0) urlString = urlString.substring(0, endIdx);
                }
            }

            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                .followRedirects(java.net.http.HttpClient.Redirect.ALWAYS)
                .connectTimeout(Duration.ofSeconds(10))
                .build();

            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(URI.create(urlString))
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
                .GET()
                .build();

            java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                String body = response.body();
                // Simple stripping of script/style tags to reduce token and focused on text content
                // (Optional but helpful for LLM) - sticking to raw html for now as per prompt request "HTML format"
                return body;
            } else {
                 System.out.println("Failed to fetch URL: " + urlString + " Status: " + response.statusCode());
                 return "";
            }
        } catch (Exception e) {
            System.out.println("Exception fetching URL " + urlString + ": " + e.getMessage());
            return "";
        }
    }
            


    private static void detectAndClickConsent(WebDriver driver) {
         try {
            // Common selectors for "Accept" or "Agree" buttons
            // We use JS to find and click because standard click can be intercepted
            JavascriptExecutor js = (JavascriptExecutor) driver;
            
            String[] xpaths = {
                "//button[contains(text(), 'Accept')]",
                "//button[contains(text(), 'Aceptar')]",
                "//button[contains(text(), 'Agree')]",
                "//button[contains(text(), 'Allow all')]",
                "//a[contains(text(), 'Accept')]",
                "//div[contains(@class, 'cookie')]//button",
                "//button[contains(@id, 'accept')]",
                "//button[contains(@class, 'agree')]"
            };

            for (String xpath : xpaths) {
                 List<WebElement> elements = driver.findElements(By.xpath(xpath));
                 for (WebElement el : elements) {
                     if (el.isDisplayed() && el.isEnabled()) {
                         try {
                             System.out.println("Attempting to click consent button: " + xpath);
                             // Try normal click first
                             // el.click(); 
                             // Use JS click for better reliability on overlays
                             js.executeScript("arguments[0].click();", el);
                             
                             Thread.sleep(3000); // Wait for cookies to be set
                             return;
                         } catch (Exception e) {
                             System.out.println("Failed to click element: " + e.getMessage());
                         }
                     }
                 }
            }
        } catch (Exception e) {
            System.out.println("No consent banner interaction performed or error: " + e.getMessage());
        }
    }

    private static void detectAndClickReject(WebDriver driver) {
         try {
            // Common selectors for "Reject", "Deny" or "Refuse" buttons
            JavascriptExecutor js = (JavascriptExecutor) driver;
            
            String[] xpaths = {
                "//button[contains(text(), 'Reject')]",
                "//button[contains(text(), 'Rechazar')]",
                "//button[contains(text(), 'Deny')]",
                "//button[contains(text(), 'Refuse')]",
                "//button[contains(text(), 'Reject all')]",
                "//button[contains(text(), 'No, thanks')]",
                "//a[contains(text(), 'Reject')]"
            };

            for (String xpath : xpaths) {
                 List<WebElement> elements = driver.findElements(By.xpath(xpath));
                 for (WebElement el : elements) {
                     if (el.isDisplayed() && el.isEnabled()) {
                         try {
                             System.out.println("Attempting to click REJECT button: " + xpath);
                             js.executeScript("arguments[0].click();", el);
                             Thread.sleep(3000); 
                             return;
                         } catch (Exception e) {
                             System.out.println("Failed to click reject element: " + e.getMessage());
                         }
                     }
                 }
            }
            System.out.println("No 'Reject' button found.");
        } catch (Exception e) {
            System.out.println("Error detecting reject button: " + e.getMessage());
        }
    }
}

