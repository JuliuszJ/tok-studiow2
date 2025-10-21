package pl.dziekanat.zaliczenie_semestru;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import io.camunda.client.CamundaClient;
import io.camunda.client.api.response.ProcessInstanceEvent;
import io.camunda.process.test.api.CamundaAssert;
import io.camunda.process.test.api.CamundaProcessTestContext;
import io.camunda.process.test.api.CamundaSpringProcessTest;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.Duration;
import java.util.Map;
import static io.camunda.process.test.api.CamundaAssert.*;
import static io.camunda.process.test.api.assertions.ElementSelectors.*;
import static io.camunda.process.test.api.assertions.UserTaskSelectors.*;

@SpringBootTest
@CamundaSpringProcessTest
class ZaliczenieSemestruApplicationTests {
    @Autowired private CamundaClient client;
    @Autowired private CamundaProcessTestContext processTestContext;
    private ProcessInstanceEvent processInstance;

    @BeforeEach
    void initProcess(){
        CamundaAssert.setAssertionTimeout(Duration.ofSeconds(10));
        processInstance = client
                .newCreateInstanceCommand()
                .bpmnProcessId("zaliczenie-semestru-process")
                .latestVersion()
                .send()
                .join();
        assertThat(processInstance).isActive();
    }

    @AfterEach
    void isCompletedTest(){
        assertThat(processInstance).isCompleted();
    }

	@Test
	void testPrzykladnegoStudenta() {
        Map<String, Object> podanie = Map.of(
                        "nrAlbumu", "007",
                        "punktyECTS", 20,
                        "uzasadnienie", ""
        );
        Map<String, Object> decyzja = Map.of(
                "czyPozytywna", true,
                "uzasadnienie", "Wystarczająco dużo punktów ECTS"
        );
        testZaliczenia(podanie, decyzja, false);
	}

    @Test
    void zaMaloPunktow() {
        Map<String, Object> podanie = Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 10,
                "uzasadnienie", "AAAAAAAAAAAAAAAAAAA"
        );
        Map<String, Object> decyzja = Map.of(
                "czyPozytywna", false,
                "uzasadnienie", "Za mało punktów ECTS"
        );
        testZaliczenia(podanie, decyzja, false);
    }

    @Test
    void dobreUzasadnienie() {
        Map<String, Object> podanie = Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 15,
                "uzasadnienie", "AAAAAAAAAAAAAAAAAAA"
        );
        Map<String, Object> decyzja = Map.of(
                "czyPozytywna", true,
                "uzasadnienie", "Mało punktów ECTS ale dobre uzasadnienie"
        );
        testZaliczenia(podanie, decyzja, false);
    }

    @Test
    void decyzjaDziekanatu() {
        Map<String, Object> podanie = Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 15,
                "uzasadnienie", ""
        );
        Map<String, Object> decyzja = Map.of(
                "czyPozytywna", true,
                "uzasadnienie", "Mało punktów ECTS - warunkowe zaliczenie"
        );
        testZaliczenia(podanie, decyzja, true);
    }

    void testZaliczenia(Map<String, Object> podanieIn, Map<String, Object> decyzjaOut, boolean czyDziekanat){
        assertThatUserTask(byTaskName("Złożenie Podania")).isCreated();
        processTestContext.completeUserTask(byTaskName("Złożenie Podania"), Map.of("podanie", podanieIn));

        if(czyDziekanat){
            assertThatUserTask(byTaskName("Decyzja Dziekanatu")).isCreated();
            processTestContext.completeUserTask(byTaskName("Decyzja Dziekanatu"), Map.of("decyzja",decyzjaOut));
        }

        assertThatUserTask(byTaskName("Odebranie decyzji")).isCreated();
        assertThat(processInstance).hasVariableSatisfies("decyzja",
                Map.class, decyzja -> {
                    Assertions.assertThat(decyzja.get("czyPozytywna")).isEqualTo(decyzjaOut.get("czyPozytywna"));
                    Assertions.assertThat(decyzja.get("uzasadnienie")).isEqualTo(decyzjaOut.get("uzasadnienie"));
                });
        processTestContext.completeUserTask(byTaskName("Odebranie decyzji"));
    }
}
