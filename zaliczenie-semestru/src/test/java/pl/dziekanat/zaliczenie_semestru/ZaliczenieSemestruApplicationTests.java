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
        CamundaAssert.setAssertionTimeout(Duration.ofSeconds(20));
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
        assertThatUserTask(byTaskName("Złożenie Podania")).isCreated();
        Map<String, Object> variables = Map.of(
                "podanie", Map.of(
                        "nrAlbumu", "007",
                        "punktyECTS", 20,
                        "uzasadnienie", ""
                )
        );
        processTestContext.completeUserTask(byTaskName("Złożenie Podania"), variables);
        assertThatUserTask(byTaskName("Odebranie decyzji")).isCreated();
        assertThat(processInstance).hasVariableSatisfies("decyzja",
                Map.class, decyzja -> {
                    Assertions.assertThat(decyzja.get("czyPozytywna")).isEqualTo(Boolean.TRUE);
                });
        processTestContext.completeUserTask(byTaskName("Odebranie decyzji"));
	}

}
