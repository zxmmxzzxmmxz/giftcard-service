package com.dlb.giftcards.service;

import com.dlb.giftcards.dto.WalmartGiftCardDtos;
import jakarta.mail.BodyPart;
import jakarta.mail.Flags;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.search.AndTerm;
import jakarta.mail.search.FlagTerm;
import jakarta.mail.search.FromStringTerm;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Properties;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GmailWalmartGiftCardListenerService {

    private static final Logger log = LoggerFactory.getLogger(GmailWalmartGiftCardListenerService.class);

    public record Status(
            boolean running,
            Instant endAt,
            Instant lastPollAt,
            String lastError
    ) {}

    private static final Duration DEFAULT_DURATION = Duration.ofHours(2);
    private static final Duration POLL_INTERVAL = Duration.ofSeconds(10);
    private static final String IMAP_HOST = "imap.gmail.com";

    private static final Pattern BONUS_CODE = Pattern.compile(
            "\\bBonus\\s*Code\\b\\s*[:：\\-]?\\s*\\*?\\s*([\\d\\s]{6,})\\s*\\*?",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern PIN = Pattern.compile(
            "\\bPIN\\b\\s*[:：\\-]?\\s*\\*?\\s*([\\d\\s]{3,})\\s*\\*?\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern BONUS_AMOUNT = Pattern.compile(
            "\\$\\s*(\\d+(?:\\.\\d+)?)\\s*bonus",
            Pattern.CASE_INSENSITIVE
    );

    private final WalmartGiftCardService walmartGiftCardService;

    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "gmail-walmart-giftcard-listener");
        t.setDaemon(true);
        return t;
    });

    private final Object lock = new Object();
    private ScheduledFuture<?> future;
    private volatile Instant endAt;
    private volatile Instant lastPollAt;
    private volatile String lastError;

    public GmailWalmartGiftCardListenerService(WalmartGiftCardService walmartGiftCardService) {
        this.walmartGiftCardService = walmartGiftCardService;
    }

    public Status start() {
        return start(DEFAULT_DURATION);
    }

    public Status start(Duration duration) {
        synchronized (lock) {
            if (future != null && !future.isDone()) {
                log.info("Gmail listener already running (endAt={})", endAt);
                return status();
            }

            this.endAt = Instant.now().plus(duration);
            this.lastError = null;
            this.lastPollAt = null;

            log.info("Gmail listener started (pollEvery={}s, duration={}s, endAt={})",
                    POLL_INTERVAL.toSeconds(), duration.toSeconds(), endAt);

            this.future = executor.scheduleWithFixedDelay(
                    this::pollSafely,
                    0,
                    POLL_INTERVAL.toSeconds(),
                    TimeUnit.SECONDS
            );

            return status();
        }
    }

    public Status stop() {
        synchronized (lock) {
            if (future != null) {
                future.cancel(false);
                future = null;
            }
            log.info("Gmail listener stopped");
            return status();
        }
    }

    public Status status() {
        boolean running = future != null && !future.isDone();
        return new Status(running, endAt, lastPollAt, lastError);
    }

    private void pollSafely() {
        try {
            if (endAt != null && Instant.now().isAfter(endAt)) {
                log.info("Gmail listener duration ended (endAt={})", endAt);
                stop();
                return;
            }
            pollOnce();
            lastError = null;
        } catch (Exception e) {
            lastError = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            log.warn("Gmail listener poll failed: {}", lastError, e);
        } finally {
            lastPollAt = Instant.now();
        }
    }

    private void pollOnce() throws Exception {
        String email = System.getenv("GMAIL_ADDRESS");
        String appPassword = System.getenv("GMAIL_APP_PASSWORD");
        if (email == null || email.isBlank()) throw new IllegalStateException("Missing env var: GMAIL_ADDRESS");
        if (appPassword == null || appPassword.isBlank()) throw new IllegalStateException("Missing env var: GMAIL_APP_PASSWORD");

        boolean logBody = Boolean.parseBoolean(System.getenv().getOrDefault("GMAIL_LISTENER_LOG_BODY", "false"));
        int maxBodyChars = parseIntOrDefault(System.getenv("GMAIL_LISTENER_LOG_BODY_MAX_CHARS"), 2000);
        boolean markSeen = Boolean.parseBoolean(System.getenv().getOrDefault("GMAIL_LISTENER_MARK_SEEN", "true"));
        String fromFilter = System.getenv().getOrDefault("GMAIL_LISTENER_FROM", "noreply@getmybonus.ca").trim();
        if (fromFilter.isBlank()) fromFilter = "noreply@getmybonus.ca";

        Properties props = new Properties();
        props.setProperty("mail.store.protocol", "imaps");
        props.setProperty("mail.imaps.host", IMAP_HOST);
        props.setProperty("mail.imaps.port", "993");
        props.setProperty("mail.imaps.ssl.enable", "true");

        Session session = Session.getInstance(props);
        Store store = session.getStore("imaps");
        store.connect(IMAP_HOST, email, appPassword);

        Folder inbox = store.getFolder("INBOX");
        inbox.open(Folder.READ_WRITE);

        try {
            // Unread emails from fromFilter
            Message[] messages = inbox.search(new AndTerm(
                    new FromStringTerm(fromFilter),
                    new FlagTerm(new Flags(Flags.Flag.SEEN), false)
            ));

            log.info("Gmail poll: unread from {} = {}", fromFilter, messages.length);

            for (Message msg : messages) {
                String messageId = header(msg, "Message-ID");
                String subject = safe(msg.getSubject());
                Date received = msg.getReceivedDate();
                String from = safeFrom(msg);
                String contentType = safe(msg.getContentType());

                String body = extractText(msg);
                if (body == null) body = "";
                int bodyLen = body.length();
                if (logBody) {
                    log.info("Email received (messageId={}, from={}, subject={}, receivedAt={}, contentType={}, bodyChars={}) body={}",
                            safe(messageId), from, subject, received, contentType, bodyLen, truncate(body, maxBodyChars));
                } else {
                    log.info("Email received (messageId={}, from={}, subject={}, receivedAt={}, contentType={}, bodyChars={}) bodySnippet={}",
                            safe(messageId), from, subject, received, contentType, bodyLen, truncate(oneLine(body), 240));
                }

                if (body.isBlank()) {
                    log.info("Skip email (messageId={}): empty body extracted; leaving unread for investigation", safe(messageId));
                    continue;
                }

                boolean hasWalmart = containsIgnoreCase(subject, "walmart") || containsIgnoreCase(body, "walmart");
                if (!hasWalmart) {
                    log.info("Skip email (messageId={}): no 'Walmart' keyword", safe(messageId));
                    if (markSeen) msg.setFlag(Flags.Flag.SEEN, true);
                    continue;
                }

                ParseAttempt parsed = parseAttempt(body);
                if (!parsed.qualifies) {
                    log.info("Skip email (messageId={}): {}", safe(messageId), parsed.reason);
                    if (containsIgnoreCase(parsed.reason, "Missing 'Bonus Code")
                            || containsIgnoreCase(parsed.reason, "Missing 'PIN")
                            || containsIgnoreCase(parsed.reason, "Missing '$<amount>")) {
                        log.info("Parse debug (messageId={}): {}", safe(messageId), parseDebug(body));
                    }
                    if (markSeen) msg.setFlag(Flags.Flag.SEEN, true);
                    continue;
                }

                try {
                    WalmartGiftCardDtos.UpsertWalmartGiftCardRequest req = new WalmartGiftCardDtos.UpsertWalmartGiftCardRequest();
                    req.cardNumber = parsed.cardNumber;
                    req.pin = parsed.pin;
                    req.balance = parsed.balance;
                    walmartGiftCardService.create(req);
                    log.info("Created Walmart gift card from email (messageId={}, cardNumber=****{}, pin=****{}, balance={})",
                            safe(messageId),
                            keepLast(parsed.cardNumber, 4),
                            keepLast(parsed.pin, 2),
                            parsed.balance);
                } catch (IllegalArgumentException dupOrValidation) {
                    // ignore duplicates / validation errors for a single email
                    log.info("Did not create Walmart gift card (messageId={}): {}", safe(messageId), dupOrValidation.getMessage());
                }

                // Mark as read to avoid re-processing
                if (markSeen) msg.setFlag(Flags.Flag.SEEN, true);
            }
        } finally {
            try { inbox.close(true); } catch (Exception ignore) {}
            try { store.close(); } catch (Exception ignore) {}
        }
    }

    private static class ParseAttempt {
        final boolean qualifies;
        final String reason;
        final String cardNumber;
        final String pin;
        final BigDecimal balance;

        private ParseAttempt(boolean qualifies, String reason, String cardNumber, String pin, BigDecimal balance) {
            this.qualifies = qualifies;
            this.reason = reason;
            this.cardNumber = cardNumber;
            this.pin = pin;
            this.balance = balance;
        }

        static ParseAttempt ok(String cardNumber, String pin, BigDecimal balance) {
            return new ParseAttempt(true, "ok", cardNumber, pin, balance);
        }

        static ParseAttempt fail(String reason) {
            return new ParseAttempt(false, reason, null, null, null);
        }
    }

    private ParseAttempt parseAttempt(String content) {
        String cardNumber = firstMatchDigits(BONUS_CODE, content);
        String pin = firstMatchDigits(PIN, content);
        String amount = firstMatch(BONUS_AMOUNT, content);

        if (cardNumber == null) return ParseAttempt.fail("Missing 'Bonus Code' + digits");
        if (pin == null) return ParseAttempt.fail("Missing 'PIN' + digits");
        if (amount == null) return ParseAttempt.fail("Missing '$<amount> bonus'");
        BigDecimal balance;
        try {
            balance = new BigDecimal(amount).setScale(2, RoundingMode.HALF_UP);
        } catch (Exception e) {
            return ParseAttempt.fail("Invalid bonus amount: " + amount);
        }

        return ParseAttempt.ok(cardNumber, pin, balance);
    }

    private String firstMatch(Pattern p, String s) {
        Matcher m = p.matcher(s);
        if (!m.find()) return null;
        String v = m.group(1);
        if (v == null) return null;
        v = v.trim();
        return v.isBlank() ? null : v;
    }

    private String firstMatchDigits(Pattern p, String s) {
        String v = firstMatch(p, s);
        if (v == null) return null;
        String digits = v.replaceAll("\\D", "");
        return digits.isBlank() ? null : digits;
    }

    private String extractText(Part p) {
        try {
            if (p.isMimeType("text/plain")) {
                Object c = p.getContent();
                return c == null ? "" : c.toString();
            }
            if (p.isMimeType("text/html")) {
                Object c = p.getContent();
                return c == null ? "" : stripHtml(c.toString());
            }
            if (p.isMimeType("message/rfc822")) {
                Object c = p.getContent();
                if (c instanceof Message m) {
                    return extractText(m);
                }
                return c == null ? "" : c.toString();
            }
            if (p.isMimeType("multipart/*")) {
                Multipart mp = (Multipart) p.getContent();
                String text = null;
                for (int i = 0; i < mp.getCount(); i++) {
                    BodyPart bp = mp.getBodyPart(i);
                    // prefer text/plain
                    if (bp.isMimeType("text/plain")) {
                        String t = extractText(bp);
                        if (t != null && !t.isBlank()) return t;
                    }
                    if (text == null && bp.isMimeType("text/html")) {
                        String t = extractText(bp);
                        if (t != null && !t.isBlank()) text = t;
                    }
                    if (text == null && bp.isMimeType("message/rfc822")) {
                        String t = extractText(bp);
                        if (t != null && !t.isBlank()) text = t;
                    }
                    if (text == null && bp.isMimeType("multipart/*")) {
                        String t = extractText(bp);
                        if (t != null && !t.isBlank()) text = t;
                    }
                }
                return text == null ? "" : text;
            }
        } catch (Exception ignore) {
            return "";
        }
        return "";
    }

    private String stripHtml(String html) {
        if (html == null) return "";
        // Minimal stripping; good enough for keyword + regex extraction
        String noScript = html.replaceAll("(?is)<script.*?>.*?</script>", " ");
        String noStyle = noScript.replaceAll("(?is)<style.*?>.*?</style>", " ");
        String noTags = noStyle.replaceAll("(?is)<[^>]+>", " ");
        return noTags.replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
    }

    private int parseIntOrDefault(String v, int def) {
        if (v == null) return def;
        try {
            return Integer.parseInt(v.trim());
        } catch (Exception e) {
            return def;
        }
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        if (max <= 0) return "";
        if (s.length() <= max) return s;
        return s.substring(0, max) + " ...";
    }

    private String oneLine(String s) {
        if (s == null) return "";
        return s.replaceAll("\\s+", " ").trim();
    }

    private String header(Message msg, String key) {
        try {
            String[] v = msg.getHeader(key);
            if (v == null || v.length == 0) return null;
            return v[0];
        } catch (Exception e) {
            return null;
        }
    }

    private String safe(String s) {
        if (s == null) return "";
        return s.replaceAll("[\\r\\n]+", " ").trim();
    }

    private String safeFrom(Message msg) {
        try {
            if (msg.getFrom() == null || msg.getFrom().length == 0) return "";
            return safe(msg.getFrom()[0].toString());
        } catch (Exception e) {
            return "";
        }
    }

    private String keepLast(String s, int n) {
        if (s == null) return "";
        String v = s.trim();
        if (v.length() <= n) return v;
        return v.substring(v.length() - n);
    }

    private boolean containsIgnoreCase(String s, String token) {
        if (s == null || token == null) return false;
        String a = s.toLowerCase();
        String b = token.toLowerCase();
        return a.contains(b);
    }

    private String parseDebug(String body) {
        if (body == null) return "";
        String one = oneLine(body);
        String bonusSnippet = snippetAfter(one, "bonus code", 180);
        String pinSnippet = snippetAfter(one, "pin", 120);
        String amountSnippet = snippetAfter(one, " bonus", 120);

        return "snippets={" +
                "bonusCode=" + redactDigits(bonusSnippet) +
                ", pin=" + redactDigits(pinSnippet) +
                ", amount=" + redactDigits(amountSnippet) +
                "}";
    }

    private String snippetAfter(String s, String token, int maxChars) {
        if (s == null || token == null) return "";
        String lower = s.toLowerCase();
        int idx = lower.indexOf(token.toLowerCase());
        if (idx < 0) return "";
        int end = Math.min(s.length(), idx + maxChars);
        return s.substring(idx, end);
    }

    private String redactDigits(String s) {
        if (s == null) return "";
        return s.replaceAll("\\d", "X");
    }
}
