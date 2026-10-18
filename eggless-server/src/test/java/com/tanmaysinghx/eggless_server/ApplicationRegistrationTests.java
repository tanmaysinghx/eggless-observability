package com.tanmaysinghx.eggless_server;

import com.tanmaysinghx.eggless_server.controller.LogController;
import com.tanmaysinghx.eggless_server.dto.ApplicationRegistrationDto;
import com.tanmaysinghx.eggless_server.dto.CreateApplicationRequest;
import com.tanmaysinghx.eggless_server.dto.LogEntryDto;
import com.tanmaysinghx.eggless_server.service.ApplicationService;
import com.tanmaysinghx.eggless_server.service.LogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:appreg;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "eggless.home=${java.io.tmpdir}/eggless-test-${random.uuid}",
        "eggless.alerts.evaluation-interval-ms=3600000"
})
class ApplicationRegistrationTests {

    @Autowired ApplicationService applicationService;
    @Autowired LogController logController;
    @Autowired LogService logService;

    private static CreateApplicationRequest request(String name) {
        CreateApplicationRequest r = new CreateApplicationRequest();
        r.setName(name);
        r.setEnvironment("staging");
        r.setDescription("Checkout flow");
        return r;
    }

    private static LogEntryDto log(String service, String message) {
        return LogEntryDto.builder().service(service).level("INFO").message(message).build();
    }

    @Test
    void registeredApplicationIsPendingAndGetsABoundKey() {
        ApplicationRegistrationDto reg = applicationService.register(request("Checkout-Web"));

        assertThat(reg.getApplication().getName()).isEqualTo("checkout-web");
        assertThat(reg.getApplication().getEnvironment()).isEqualTo("staging");
        assertThat(reg.getApplication().getStatus()).isEqualTo("pending");
        assertThat(reg.getApiKey().getToken()).startsWith("egg_sec_");
        assertThat(reg.getApiKey().getApplication()).isEqualTo("checkout-web");
    }

    @Test
    void rejectsDuplicateAndInvalidNames() {
        applicationService.register(request("billing-api"));

        assertThatThrownBy(() -> applicationService.register(request("Billing-API")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("already exists");
        for (String bad : new String[]{"", "ab", "has space", "-leading", "trailing-", "UPPER$"}) {
            assertThatThrownBy(() -> applicationService.register(request(bad))).isInstanceOf(IllegalArgumentException.class);
        }
        CreateApplicationRequest badEnv = request("env-test");
        badEnv.setEnvironment("prod-eu");
        assertThatThrownBy(() -> applicationService.register(badEnv)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void boundKeyFillsInServiceAndCannotWriteForAnotherApp() {
        String token = applicationService.register(request("orders-worker")).getApiKey().getToken();

        assertThat(logController.ingestSingleLog(token, null, log(null, "picked job 7")).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(logController.ingestSingleLog(token, null, log("orders-worker", "done job 7")).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(logController.ingestSingleLog(token, null, log("payment-api", "spoofed")).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(logController.ingestBatch(token, null, List.of(log(null, "ok"), log("other", "spoofed"))).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);

        @SuppressWarnings("unchecked")
        List<LogEntryDto> logs = (List<LogEntryDto>) logService.queryLogs("orders-worker", null, null, null, null, 50, 0).get("logs");
        assertThat(logs).extracting(LogEntryDto::getMessage).containsExactlyInAnyOrder("picked job 7", "done job 7");
        assertThat(logs).allMatch(l -> l.getEnvironment().equals("staging")); // the app's registered environment
        assertThat(logService.queryLogs(null, null, null, "spoofed", null, 50, 0).get("count")).isEqualTo(0);

        assertThat(applicationService.getAllApplications())
                .filteredOn(a -> a.getName().equals("orders-worker")).singleElement()
                .satisfies(a -> assertThat(a.getStatus()).isEqualTo("healthy"));
    }

    @Test
    void deletingAnApplicationRevokesItsKey() {
        ApplicationRegistrationDto reg = applicationService.register(request("temp-app"));
        applicationService.delete(reg.getApplication().getId());

        assertThat(logController.ingestSingleLog(reg.getApiKey().getToken(), null, log(null, "late")).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(applicationService.getAllApplications()).noneMatch(a -> a.getName().equals("temp-app"));
    }
}
