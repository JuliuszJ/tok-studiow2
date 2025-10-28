package pl.dziekanat.zaliczenie_semestru;

import io.camunda.client.CamundaClient;
import io.camunda.client.api.response.ProcessInstanceEvent;
import io.camunda.process.test.api.CamundaAssert;
import io.camunda.process.test.api.CamundaProcessTestContext;
import io.camunda.process.test.api.CamundaSpringProcessTest;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.Duration;
import java.util.Map;

import static io.camunda.process.test.api.CamundaAssert.assertThat;

@SpringBootTest
@CamundaSpringProcessTest
public class PobranieOplatyTest {
    @Autowired
    private CamundaClient client;
    @Autowired private CamundaProcessTestContext processTestContext;
    private ProcessInstanceEvent processInstance;

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
        if(!sukces){
            assertThat(oplataProcessInstance).hasActiveIncidents();
        }
    }
}
