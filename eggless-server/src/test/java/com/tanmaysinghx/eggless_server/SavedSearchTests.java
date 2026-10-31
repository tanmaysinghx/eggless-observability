package com.tanmaysinghx.eggless_server;

import com.tanmaysinghx.eggless_server.auth.SessionUser;
import com.tanmaysinghx.eggless_server.dto.SavedSearchDto;
import com.tanmaysinghx.eggless_server.service.SavedSearchService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:savedsearches;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
        "eggless.home=${java.io.tmpdir}/eggless-test-${random.uuid}",
        "eggless.alerts.evaluation-interval-ms=3600000"
})
class SavedSearchTests {

    @Autowired SavedSearchService savedSearchService;

    private static final SessionUser ALICE =
            new SessionUser("u1", "alice@example.com", "Alice", List.of("ROLE_USER"), "test", Instant.now().plusSeconds(3600));

    private static SavedSearchDto search(String name, String query, List<String> levels, String timeRange) {
        return SavedSearchDto.builder().name(name).query(query).levels(levels).timeRange(timeRange).build();
    }

    @Test
    void createStoresTheQueryAndWhoSavedIt() {
        SavedSearchDto created = savedSearchService.create(
                search("  Payment errors ", "service:payment-api timeout", List.of("ERROR", "WARN"), "24h"), ALICE);

        assertThat(created.getId()).startsWith("srch_");
        assertThat(created.getName()).isEqualTo("Payment errors");
        assertThat(created.getLevels()).containsExactly("ERROR", "WARN");
        assertThat(created.getTimeRange()).isEqualTo("24h");
        assertThat(created.getApplication()).isEqualTo("all");
        assertThat(created.getCreatedBy()).isEqualTo("Alice");
        assertThat(savedSearchService.getAll()).extracting(SavedSearchDto::getId).contains(created.getId());
    }

    @Test
    void rejectsInvalidDefinitions() {
        assertThatThrownBy(() -> savedSearchService.create(search(" ", "x", List.of(), "1h"), ALICE))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> savedSearchService.create(search("Bad level", "x", List.of("LOUD"), "1h"), ALICE))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> savedSearchService.create(search("Bad range", "x", List.of(), "soon"), ALICE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateAndDelete() {
        SavedSearchDto created = savedSearchService.create(search("Errors", "level:error", List.of(), "1h"), ALICE);

        SavedSearchDto updated = savedSearchService.update(created.getId(), search("Recent errors", "level:error", List.of(), "15m"));
        assertThat(updated.getName()).isEqualTo("Recent errors");
        assertThat(updated.getTimeRange()).isEqualTo("15m");
        assertThat(updated.getCreatedBy()).isEqualTo("Alice");

        savedSearchService.delete(created.getId());
        assertThat(savedSearchService.getAll()).extracting(SavedSearchDto::getId).doesNotContain(created.getId());
        assertThatThrownBy(() -> savedSearchService.delete(created.getId())).isInstanceOf(NoSuchElementException.class);
    }
}
