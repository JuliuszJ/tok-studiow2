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
import static io.camunda.process.test.api.CamundaAssert.*;


import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import static io.camunda.process.test.api.CamundaAssert.assertThat;
import static io.camunda.process.test.api.assertions.UserTaskSelectors.byTaskName;

@SpringBootTest
@CamundaSpringProcessTest
public class OdwolanieTest {
    @Autowired
    private CamundaClient client;
    @Autowired private CamundaProcessTestContext processTestContext;


@Test
    void odwolanie(){
        CamundaAssert.setAssertionTimeout(Duration.ofSeconds(15));

    Map<String, Object> podanie = Map.of(
            "nrAlbumu", "007",
            "punktyECTS", 15,
            "uzasadnienie", "",
            "nrSprawy", java.util.UUID.randomUUID().toString()
    );
    Map<String, Object> decyzja = Map.of(
            "czyPozytywna", false,
            "uzasadnienie", ""
    );



    String receiver =
"<?xml version='1.0' encoding='UTF-8'?>" +
        "<bpmn:definitions xmlns:bpmn='http://www.omg.org/spec/BPMN/20100524/MODEL' xmlns:bpmndi='http://www.omg.org/spec/BPMN/20100524/DI' xmlns:dc='http://www.omg.org/spec/DD/20100524/DC' xmlns:zeebe='http://camunda.org/schema/zeebe/1.0' xmlns:di='http://www.omg.org/spec/DD/20100524/DI' xmlns:modeler='http://camunda.org/schema/modeler/1.0' id='Definitions_0dwfrp8' targetNamespace='http://bpmn.io/schema/bpmn' exporter='Camunda Modeler' exporterVersion='5.39.0' modeler:executionPlatform='Camunda Cloud' modeler:executionPlatformVersion='8.7.0'>" +
        "  <bpmn:process id='receiver' isExecutable='true'>" +
        "    <bpmn:startEvent id='StartEvent_1'>" +
        "      <bpmn:outgoing>start2catch</bpmn:outgoing>" +
        "    </bpmn:startEvent>" +
        "    <bpmn:sequenceFlow id='start2catch' sourceRef='StartEvent_1' targetRef='Event_catch_odwolanie' />" +
        "    <bpmn:intermediateCatchEvent id='Event_catch_odwolanie'>" +
        "      <bpmn:extensionElements>" +
        "        <zeebe:ioMapping>" +
        "          <zeebe:output source='=decyzja' target='decyzja' />" +
        "        </zeebe:ioMapping>" +
        "      </bpmn:extensionElements>" +
        "      <bpmn:incoming>start2catch</bpmn:incoming>" +
        "      <bpmn:outgoing>catch2end</bpmn:outgoing>" +
        "      <bpmn:messageEventDefinition id='odwolanie-res-msg-def-id' messageRef='odwolanie-res-msg-id' />" +
        "    </bpmn:intermediateCatchEvent>" +
        "    <bpmn:endEvent id='EndEvent_1'>" +
        "      <bpmn:incoming>catch2end</bpmn:incoming>" +
        "    </bpmn:endEvent>" +
        "    <bpmn:sequenceFlow id='catch2end' sourceRef='Event_catch_odwolanie' targetRef='EndEvent_1' />" +
        "  </bpmn:process>" +
        "  <bpmn:message id='odwolanie-res-msg-id' name='odwolanie-res-msg'>" +
        "    <bpmn:extensionElements>" +
        "      <zeebe:subscription correlationKey='=podanie.nrSprawy' />" +
        "    </bpmn:extensionElements>" +
        "  </bpmn:message>" +
        "</bpmn:definitions>";

    client.newDeployResourceCommand()
            .addResourceString(receiver, StandardCharsets.UTF_8, "receiver.bpmn")
            .send()
            .join();
    ProcessInstanceEvent receiverInstance = client.newCreateInstanceCommand()
            .bpmnProcessId("receiver")
            .latestVersion()
            .variables(Map.of("podanie", podanie))
            .send()
            .join();

    client
            .newPublishMessageCommand()
            .messageName("odwolanie-req-msg")
            .withoutCorrelationKey()
            .variables(
                    Map.of(
                            "podanie", podanie,
                            "decyzja", decyzja
                    ))
            .send()
            .join();

    assertThatUserTask(byTaskName("Decyzja Rektora")).isCreated();
    assertThatUserTask(byTaskName("Decyzja Dziekana")).isCreated();
    processTestContext.completeUserTask(byTaskName("Decyzja Rektora"), Map.of("decyzja", Map.of("czyPozytywna", true, "uzasadnienie", "decyzja Rektora")));
    assertThatUserTask(byTaskName("Decyzja Rektora")).isCompleted();
    assertThatUserTask(byTaskName("Decyzja Dziekana")).isCanceled();

    assertThatProcessInstance(receiverInstance).isCompleted();

    assertThat(receiverInstance).hasVariableSatisfies("decyzja",
            Map.class, decyzjaOut -> {
                Assertions.assertThat(decyzjaOut.get("uzasadnienie")).isNotEqualTo("");
            });
    }

    @Test
    void caller(){
        CamundaAssert.setAssertionTimeout(Duration.ofSeconds(15));

        ProcessInstanceEvent caller = client
                .newCreateInstanceCommand()
                .bpmnProcessId("caller")
                .latestVersion()
                .send()
                .join();
        assertThatProcessInstance(caller).hasCompletedElement("send", 1);

        assertThatUserTask(byTaskName("Decyzja Rektora")).isCreated();
        assertThatUserTask(byTaskName("Decyzja Dziekana")).isCreated();
        processTestContext.completeUserTask(byTaskName("Decyzja Rektora"), Map.of("decyzja", Map.of("czyPozytywna", true, "uzasadnienie", "decyzja Rektora")));

        assertThatProcessInstance(caller).hasCompletedElement("receive", 1);

        assertThatProcessInstance(caller).isCompleted();

        assertThat(caller).hasVariableSatisfies("decyzja",
                Map.class, decyzja -> {
                    Assertions.assertThat(decyzja.get("uzasadnienie")).isNotEqualTo("");
                });


    }

}
