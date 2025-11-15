package pl.dziekanat.zaliczenie_semestru;

import io.camunda.client.api.command.ClientException;
import io.camunda.client.api.search.enums.UserTaskState;
import io.camunda.client.api.search.response.UserTask;
import io.camunda.process.test.api.assertions.UserTaskSelector;
import io.camunda.shaded.awaitility.Awaitility;
import org.jetbrains.annotations.NotNull;
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
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

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
    void zaMaloPunktowPozytwneOdwolanie() {
        Map<String, Object> podanie = Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 10,
                "uzasadnienie", "AAAAAAAAAAAAAAAAAAA",
                "nrSprawy", java.util.UUID.randomUUID().toString(),
                "czyOdwolanie", true
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
        Map<String, Object> oplata = new HashMap<>(Map.of(
                "nrKonta", "007",
                "kwota",  100,
                "czyZgoda", false,
                "status", "",
                "nrTrans", ""
        ));
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
                "kwota",  -100,
                "czyZgoda", true,
                "status", "",
                "nrTrans", ""
        ));
        testZaliczenia(podanie, decyzjaOut, decyzjaOut, oplata, true);
    }

    @Test
    void decyzjaDziekanatuTimeoutZeZgoda() {
        Map<String, Object> podanie = Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 15,
                "uzasadnienie", ""
        );
        Map<String, Object> decyzjaOut = Map.of(
                "czyPozytywna", true,
                "uzasadnienie", "brak czasu na rozpatrzenie"
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
        processTestContext.mockJobWorker("rejestracja-odwolania").thenComplete();
        assertThatUserTask(byTaskName("Złożenie Podania")).isCreated();
        processTestContext.completeUserTask(byTaskName("Złożenie Podania"), Map.of("podanie", podanieIn));

        if(czyDziekanat){
            assertThatUserTask(byTaskName("Decyzja Dziekanatu")).isCreated();
            if (decyzjaOut!=null && "brak czasu na rozpatrzenie".equals(decyzjaOut.get("uzasadnienie"))) {
                processTestContext.increaseTime(Duration.ofDays(7));
                assertThat(processInstance).hasCompletedElements("dziekanat-deadline");
            }else {
                processTestContext.completeUserTask(byTaskName("Decyzja Dziekanatu"), Map.of("decyzja", decyzjaDziekanatu));
            }
            if(oplata!=null) {
                assertThatUserTask(byTaskName("Dane Płatności")).isCreated();
                processTestContext.completeUserTask(byTaskName("Dane Płatności"), Map.of("oplata", oplata));
                if ( (int)oplata.get("kwota") <0 ) {
                    assertThat(processInstance).hasCompletedElements("catch-oplata-kwota-err");

                    long platnoscInstanceKey = assertNewUserTaskCreated(processInstance.getProcessInstanceKey(), "Dane Płatności");
                    oplata.put("kwota", 100);
                    processTestContext.completeUserTask(byUserTaskInstanceKey(platnoscInstanceKey), Map.of("oplata", oplata));
                }

            }

        }
        if(czyDziekanat && oplata!=null && (boolean) oplata.get("czyZgoda")) {
            assertThat(processInstance).hasVariableSatisfies("oplata",
                    Map.class, oplataTest -> {
                        Assertions.assertThat(oplataTest.get("nrTrans")).isEqualTo("ABC321");
                    });
        }

        assertThatUserTask(byTaskName("Odebranie decyzji")).isCreated();
        assertThat(processInstance).hasVariableSatisfies("decyzja",
                Map.class, decyzja -> {
                    Assertions.assertThat(decyzja.get("czyPozytywna")).isEqualTo(decyzjaOut.get("czyPozytywna"));
                    Assertions.assertThat(decyzja.get("uzasadnienie")).isEqualTo(decyzjaOut.get("uzasadnienie"));
                });

        processTestContext.completeUserTask(byTaskName("Odebranie decyzji"),  Map.of("podanie", podanieIn));
        Boolean czyOdwolanie = (Boolean) podanieIn.get("czyOdwolanie");
        if (czyOdwolanie!=null && czyOdwolanie) {
          assertThat(processInstance).hasCompletedElements("rejestracja-odwolania");
/*
            final Map<String, Object> finalPodanieIn = podanieIn;
            assertThat(processInstance).hasVariableSatisfies("podanie",
                    Map.class, podanie -> {
                        Assertions.assertThat(podanie.get("nrAlbumu")).isEqualTo(finalPodanieIn.get("nrAlbumu"));
                        Assertions.assertThat(podanie.get("rejestracjaOdwolania")).isEqualTo(true);
                    });
*/
            assertThatUserTask(byTaskName("Decyzja Rektora")).isCreated();
            assertThatUserTask(byTaskName("Decyzja Dziekana")).isCreated();



            Map<String, Object> decyzjaRektora =  Map.of("czyPozytywna", true, "uzasadnienie", "decyzja Rektora");
            processTestContext.completeUserTask(byTaskName("Decyzja Rektora"),Map.of("decyzja", decyzjaRektora));
            assertThatUserTask(byTaskName("Decyzja Rektora")).isCompleted();
            assertThatUserTask(byTaskName("Decyzja Dziekana")).isCanceled();

            long odebranieDecyzjiInstanceKey= assertNewUserTaskCreated(processInstance.getProcessInstanceKey(), "Odebranie decyzji");
            podanieIn = new HashMap<>(podanieIn);
            podanieIn.put("czyOdwolanie", false);
            processTestContext.completeUserTask(byUserTaskInstanceKey(odebranieDecyzjiInstanceKey),
                    Map.of("podanie", podanieIn));
            assertThatUserTask(byUserTaskInstanceKey(odebranieDecyzjiInstanceKey)).isCompleted();
            assertThat(processInstance).hasVariableSatisfies("decyzja",
                    Map.class, decyzja -> {
                        Assertions.assertThat(decyzja.get("czyPozytywna")).isEqualTo(decyzjaRektora.get("czyPozytywna"));
                        Assertions.assertThat(decyzja.get("uzasadnienie")).isEqualTo(decyzjaRektora.get("uzasadnienie"));
                    });
        }

        isCompletedTest();
    }

    long assertNewUserTaskCreated(final long processInstanceKey, final String userTaskName) {
        final AtomicReference<Long> elementInstanceKeyRef = new AtomicReference<>();
        Awaitility.await()
                .ignoreException(ClientException.class)
                .untilAsserted(
                        () -> {
                            final List<UserTask> userTasks = getUserTasks(processInstanceKey);
                            org.junit.jupiter.api.Assertions.assertFalse(userTasks.isEmpty());
                            final UserTask userTask = userTasks.getFirst();
                            org.junit.jupiter.api.Assertions.assertEquals(userTaskName, userTask.getName());
                            elementInstanceKeyRef.set(userTask.getElementInstanceKey());
                        });
        return  elementInstanceKeyRef.get();
    }

    private List<UserTask> getUserTasks(final long processInstanceKey) {
        return client
                .newUserTaskSearchRequest()
                .filter(filter -> filter.processInstanceKey(processInstanceKey).state(UserTaskState.CREATED))
                .send()
                .join()
                .items();
    }
    private static @NotNull UserTaskSelector byUserTaskInstanceKey(long userTaskInstanceKey) {
        return userTask -> userTask.getElementInstanceKey() == userTaskInstanceKey;
    }
}
