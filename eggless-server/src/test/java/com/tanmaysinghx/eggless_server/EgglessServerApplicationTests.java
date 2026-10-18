package com.tanmaysinghx.eggless_server;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

// In-memory DB and a throwaway home so tests never touch ~/.eggless.
@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:contextloads;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
		"eggless.home=${java.io.tmpdir}/eggless-test-${random.uuid}"
})
class EgglessServerApplicationTests {

	@Test
	void contextLoads() {
	}

}
