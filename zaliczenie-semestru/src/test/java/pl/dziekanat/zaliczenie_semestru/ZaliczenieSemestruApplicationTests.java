package pl.dziekanat.zaliczenie_semestru;

import io.camunda.shaded.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import io.camunda.client.CamundaClient;
import io.camunda.client.api.response.ProcessInstanceEvent;
import io.camunda.process.test.api.CamundaAssert;
import io.camunda.process.test.api.CamundaProcessTestContext;
import io.camunda.process.test.api.CamundaSpringProcessTest;
import org.assertj.core.api.Assertions;
import org.springframework.beans.factory.annotation.Autowired;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import static io.camunda.process.test.api.CamundaAssert.*;
import static io.camunda.process.test.api.assertions.UserTaskSelectors.*;

@SpringBootTest
@CamundaSpringProcessTest
class ZaliczenieSemestruApplicationTests {
    @Autowired private CamundaClient client;
    @Autowired private CamundaProcessTestContext processTestContext;
    private ProcessInstanceEvent processInstance;

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
        testZaliczenia(podanie, null, decyzja, null, false);
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
        testZaliczenia(podanie, null, decyzja, null, false);
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
        testZaliczenia(podanie, null, decyzja, null, false);
    }

    @Test
    void decyzjaDziekanatuNegatywna() {
        Map<String, Object> podanie = Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 15,
                "uzasadnienie", ""
        );
        Map<String, Object> decyzja = Map.of(
                "czyPozytywna", false,
                "uzasadnienie", "Mało punktów ECTS - brak zaliczenia"
        );

        testZaliczenia(podanie, decyzja, decyzja, null, true);
    }

    @Test
    void decyzjaDziekanatuPozytywnaBrakZgody() {
        Map<String, Object> podanie = Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 15,
                "uzasadnienie", ""
        );
        Map<String, Object> decyzjaDziekanatu = Map.of(
                "czyPozytywna", true,
                "uzasadnienie", "Mało punktów ECTS - warunkowe zaliczenia"
        );
        Map<String, Object> decyzjaOut = Map.of(
                "czyPozytywna", false,
                "uzasadnienie", "brak zgody na płatność"
        );
        Map<String, Object> oplata = Map.of(
                "nrKonta", "007",
                "kwota",  -100,
                "czyZgoda", false,
                "status", "",
                "nrTrans", ""
        );
        testZaliczenia(podanie, decyzjaDziekanatu, decyzjaOut, oplata, true);
    }

    @Test
    void decyzjaDziekanatuPozytywnaZeZgoda() {
        Map<String, Object> podanie = Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 15,
                "uzasadnienie", ""
        );
        Map<String, Object> decyzjaOut = Map.of(
                "czyPozytywna", true,
                "uzasadnienie", "Mało punktów ECTS - warunkowe zaliczenia"
        );
        Map<String, Object> oplata = new HashMap<>(Map.of(
                "nrKonta", "007",
                "kwota",  100,
                "czyZgoda", true,
                "status", "",
                "nrTrans", ""
        ));
        testZaliczenia(podanie, decyzjaOut, decyzjaOut, oplata, true);
    }

    void testZaliczenia(Map<String, Object> podanieIn, Map<String, Object> decyzjaDziekanatu, Map<String, Object> decyzjaOut,
                        Map<String, Object> oplata, boolean czyDziekanat)  {
        initProcess();
        assertThatUserTask(byTaskName("Złożenie Podania")).isCreated();
        processTestContext.completeUserTask(byTaskName("Złożenie Podania"), Map.of("podanie", podanieIn));

        if(czyDziekanat){
            assertThatUserTask(byTaskName("Decyzja Dziekanatu")).isCreated();
            processTestContext.completeUserTask(byTaskName("Decyzja Dziekanatu"), Map.of("decyzja",decyzjaDziekanatu));
            if(oplata!=null) {
                assertThatUserTask(byTaskName("Dane Płatności")).isCreated();
                processTestContext.completeUserTask(byTaskName("Dane Płatności"), Map.of("oplata", oplata));
                /* nie działa dla Camunda 8.8
                if ( (int)oplata.get("kwota") <0 ) {
                    assertThatUserTask(byTaskName("Dane Płatności")).isCreated();

                    oplata.put("kwota", 100);
                    processTestContext.completeUserTask(byTaskName("Dane Płatności"), Map.of("oplata", oplata));
                }
                 */
            }

        }

        assertThatUserTask(byTaskName("Odebranie decyzji")).isCreated();
        assertThat(processInstance).hasVariableSatisfies("decyzja",
                Map.class, decyzja -> {
                    Assertions.assertThat(decyzja.get("czyPozytywna")).isEqualTo(decyzjaOut.get("czyPozytywna"));
                    Assertions.assertThat(decyzja.get("uzasadnienie")).isEqualTo(decyzjaOut.get("uzasadnienie"));
                });
        processTestContext.completeUserTask(byTaskName("Odebranie decyzji"));
        isCompletedTest();
    }

    @Test
    void pobranieOplatySukces(){
        pobranieOplaty(true);
    }
    @Test
    void pobranieOplatyBrakSukcesu(){
        pobranieOplaty(false);
    }

    void pobranieOplaty(boolean sukces){
        CamundaAssert.setAssertionTimeout(Duration.ofSeconds(10));
        Map<String, Object> oplata = Map.of(
                "nrKonta", "007",
                "kwota", sukces ? 100 : -100,
                "czyZgoda", true,
                "status", "",
                "nrTrans", ""
        );
        ProcessInstanceEvent oplataProcessInstance = client
                .newCreateInstanceCommand()
                .bpmnProcessId("pobranie-oplaty")
                .latestVersion()
                .variables(Map.of("oplata", oplata))
                .send()
                .join();
        if(sukces) {
            assertThat(oplataProcessInstance).isCompleted();

            assertThat(oplataProcessInstance).hasVariableSatisfies("oplata",
                    Map.class, oplataTest -> {
                        Assertions.assertThat(oplataTest.get("nrTrans")).isEqualTo("ABC321");
                    });

        }
        else {
            assertThat(oplataProcessInstance).hasActiveIncidents();
        }
    }
}
