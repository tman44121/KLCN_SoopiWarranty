// Read-only oracle: existing WAR classes/libraries, Jackson-only context; no application/DB context.
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import jakarta.validation.Validation;
import jakarta.validation.constraints.*;
import tools.jackson.databind.json.JsonMapper;
import com.example.warranty_system.billing.domain.Payment;

class JavaContractProbe {
    enum Status { ACTIVE, LOCKED }
    record Sample(boolean flag, Status status, Instant at, String name, int count) {}
    record NullableSample(Boolean flag, Integer count, BigDecimal amount, LocalDate day, Instant at) {}
    record Constraints(@NotBlank String text, @Email String email, @Pattern(regexp="CASH|CARD") String method) {}

    public static void main(String[] args) throws Exception {
        ((ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME))
                .setLevel(ch.qos.logback.classic.Level.OFF);
        var context = new org.springframework.context.annotation.AnnotationConfigApplicationContext();
        context.getEnvironment().getPropertySources().addFirst(new org.springframework.core.env.MapPropertySource("probe",
                Map.of("spring.jackson.deserialization.fail-on-null-for-primitives", "false")));
        context.register(org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration.class);
        context.refresh();
        var json = context.getBean(JsonMapper.class);
        var results = new LinkedHashMap<String,Object>();
        var inputs = List.of("{\"status\":\"ACTIVE\"}", "{\"status\":\"active\"}", "{\"status\":\" ACTIVE \"}",
                "{\"status\":\"0\"}", "{\"status\":\"\"}", "{\"status\":99}", "{\"status\":\"ACTIVE,LOCKED\"}",
                "{\"status\":0}", "{\"flag\":null}", "{\"flag\":\"true\"}", "{\"flag\":\"TRUE\"}",
                "{\"flag\":1}", "{\"flag\":0}", "{\"flag\":-1}", "{\"flag\":\"\"}", "{\"flag\":\"tRuE\"}",
                "{\"name\":123}", "{\"name\":true}", "{\"name\":12.00}", "{\"Name\":\"ignored\"}",
                "{\"count\":null}", "{\"count\":\"\"}", "{\"count\":1.9}", "{\"count\":\"12\"}",
                "{\"at\":\"2026-10-02\"}", "{\"at\":\"2026-10-02T00:00:00\"}",
                "{\"at\":\"2026-10-02T00:00:00.1Z\"}", "{\"at\":\"2026-10-02T00:00:00.1234Z\"}",
                "{\"at\":\"2026-10-02T00:00:00.1234567Z\"}", "{\"at\":\"2026-10-02T07:00:00+07:00\"}",
                "{\"flag\":\"null\"}", "{\"flag\":\"False\"}", "{\"flag\":1.5}", "{\"flag\":\" false \"}",
                "{\"count\":2147483648}", "{\"count\":true}", "{\"count\":\"1.2\"}", "{\"count\":\"null\"}",
                "{\"status\":\"-1\"}", "{\"status\":\"00\"}", "{\"status\":\"+0\"}", "{\"status\":null}",
                "{\"at\":\"\"}", "{\"at\":0}", "{\"at\":\"0\"}", "{\"name\":{}}");
        for (var input : inputs) {
            try { results.put(input, json.readValue(input, Sample.class)); }
            catch (RuntimeException error) { results.put(input, "JSON_ERROR"); }
        }
        for (var input : List.of("{}", "{\"flag\":null,\"count\":null,\"amount\":null,\"day\":null}",
                "{\"flag\":\"\",\"count\":\"\",\"amount\":\"\",\"day\":\"\",\"at\":\"\"}",
                "{\"flag\":\"null\",\"count\":\"null\",\"amount\":\"null\",\"day\":\"null\"}",
                "{\"flag\":\"TRUE\",\"count\":1.9,\"amount\":\" 12.50 \"}", "{\"amount\":1e2}",
                "{\"day\":\"2026-10-02\"}", "{\"day\":\" 2026-10-02 \"}", "{\"day\":\"2026-10-02T00:00:00\"}",
                "{\"day\":\"2026-10-02T00:00:00Z\"}", "{\"day\":[2026,10,2]}", "{\"day\":\"2026-02-30\"}",
                "{\"flag\":\"null\"}", "{\"count\":\"null\"}", "{\"amount\":\"null\"}", "{\"at\":\"null\"}",
                "{\"day\":\"2026-10-02T07:00:00+07:00\"}")) {
            try { results.put("nullable:" + input, json.readValue(input, NullableSample.class)); }
            catch (RuntimeException error) { results.put("nullable:" + input, "JSON_ERROR"); }
        }
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            var values = List.of("", " ", "\u00a0", "\u2003", "a\n", "CASH", "CASH\n", "foo@localhost", "a b@host", "a..b@host",
                    "\"a b\"@host", "a@-host", "a@host-", "a@host..com", "a@host.", "a@[127.0.0.1]", "a@host\n",
                    "\u0085", "\u001c", "\u2007", "\u202f", "a@[IPv6:::1]", "a@[999.999.999.999]", "a@" + "h".repeat(64), "a@b\u00a0c");
            for (var value : values) {
                var record = new Constraints(value, value, value);
                results.put("validation:" + value, Map.of("notBlank", validator.validateProperty(record,"text").isEmpty(),
                        "email", validator.validateProperty(record,"email").isEmpty(),
                        "pattern", validator.validateProperty(record,"method").isEmpty()));
            }
        }
        for (var value : List.of("", " ", "\u0085", "\u001c", "\u00a0", "\u2003", "\u2007", "\u202f", " \u2003note\u2003 ")) {
            results.put("text:" + value, Map.of("blank", value.isBlank(), "trimmed", value.trim()));
        }
        var payment = new Payment("PT", "TN", null, "CHARGED", Instant.EPOCH, "Payer", new BigDecimal("12.00"), "CASH", "NV", " note ");
        results.put("payment:constructor", Map.of("amount", payment.amount().toPlainString(), "note", payment.note()));
        var loaded = Payment.class.getDeclaredMethod("afterLoad");
        loaded.setAccessible(true); loaded.invoke(payment);
        results.put("payment:loaded", Map.of("amount", payment.amount().toPlainString(), "note", payment.note()));
        results.put("payment:fraction", new Payment("PT", "TN", null, "CHARGED", Instant.EPOCH, "Payer", new BigDecimal("12.50"), "CASH", "NV", " ").amount().toPlainString());
        java.nio.file.Files.writeString(java.nio.file.Path.of(args[0]), json.writeValueAsString(results), java.nio.charset.StandardCharsets.UTF_8);
        context.close();
        System.out.println("PASS read-only Java oracle: " + results.size() + " JSON/validation/payment observations; no DB context");
    }
}
