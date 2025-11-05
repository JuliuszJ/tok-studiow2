package pl.dziekanat.zaliczenie_semestru;

import io.camunda.client.CamundaClient;
import io.camunda.client.api.response.CorrelateMessageResponse;
import io.camunda.client.api.response.ProcessInstanceEvent;
import io.camunda.client.api.response.PublishMessageResponse;
import io.camunda.client.api.search.response.ProcessInstance;
import io.camunda.process.test.api.CamundaAssert;
import io.camunda.process.test.api.CamundaProcessTestContext;
import io.camunda.process.test.api.CamundaSpringProcessTest;
import io.camunda.process.test.api.assertions.ProcessInstanceAssert;
import io.camunda.process.test.api.assertions.ProcessInstanceSelector;
import io.camunda.process.test.api.assertions.ProcessInstanceSelectors;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import static io.camunda.process.test.api.CamundaAssert.*;


import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import static io.camunda.process.test.api.CamundaAssert.assertThat;
import static io.camunda.process.test.api.assertions.ProcessInstanceSelectors.byKey;

@SpringBootTest
@CamundaSpringProcessTest
public class OdwolanieTest {
    @Autowired
    private CamundaClient client;
    @Autowired private CamundaProcessTestContext processTestContext;


@Test
    void odwolanie(){
        CamundaAssert.setAssertionTimeout(Duration.ofSeconds(60));

        String kluczKorelacji = java.util.UUID.randomUUID().toString();
    Map<String, Object> podanie = Map.of(
            "nrAlbumu", "007",
            "punktyECTS", 15,
            "uzasadnienie", ""
    );
    Map<String, Object> decyzja = Map.of(
            "czyPozytywna", false,
            "uzasadnienie", ""
    );
    PublishMessageResponse publishMessageResponse = client
            .newPublishMessageCommand()
            .messageName("odwolanie-req-msg")
            .withoutCorrelationKey()
            .variables(
                    Map.of(
                            "kluczKorelacji", kluczKorelacji,
                            "podanie", podanie,
                            "decyzja", decyzja
                    ))
            .send()
            .join();




    CorrelateMessageResponse correlateMessageResponse = client.newCorrelateMessageCommand()
            .messageName("odwolanie-req-msg")
            .correlationKey(kluczKorelacji)
            .send()
            .join();

    ProcessInstanceAssert processInstanceAssert = assertThatProcessInstance(byKey(correlateMessageResponse.getProcessInstanceKey()))
            .isCompleted();


    }
    @Test
    void caller(){
        CamundaAssert.setAssertionTimeout(Duration.ofSeconds(20));

        ProcessInstanceEvent caller = client
                .newCreateInstanceCommand()
                .bpmnProcessId("caller")
                .latestVersion()
                .send()
                .join();
        assertThat(caller).isCompleted();
        assertThat(caller).hasVariableSatisfies("decyzja",
                Map.class, decyzja -> {
                    Assertions.assertThat(decyzja.get("uzasadnienie")).isNotEqualTo("");
                });


    }

}
