package pl.dziekanat.zaliczenie_semestru;
import io.camunda.client.CamundaClient;
import io.camunda.client.api.command.ClientException;
import io.camunda.client.api.response.ProcessInstanceEvent;
import io.camunda.client.api.search.enums.UserTaskState;
import io.camunda.client.api.search.response.UserTask;
import io.camunda.process.test.api.CamundaAssert;
import io.camunda.process.test.api.CamundaProcessTestContext;
import io.camunda.process.test.api.CamundaSpringProcessTest;
import io.camunda.process.test.api.assertions.UserTaskSelector;
import io.camunda.shaded.awaitility.Awaitility;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static io.camunda.process.test.api.CamundaAssert.assertThat;
import static io.camunda.process.test.api.CamundaAssert.assertThatUserTask;
import static io.camunda.process.test.api.assertions.UserTaskSelectors.byTaskName;

@SpringBootTest
@CamundaSpringProcessTest
public class LoopTest {
    @Autowired
    private CamundaClient client;
    @Autowired private CamundaProcessTestContext processTestContext;

    @Test
    void loopTestBezPonowienia(){
        loopTest(false);
    }
    @Test
    void loopTestZponowieniem(){
        loopTest(true);
    }
    void loopTest(boolean ponowienie){
        CamundaAssert.setAssertionTimeout(Duration.ofSeconds(10));
        ProcessInstanceEvent loopTestInstance = client
                .newCreateInstanceCommand()
                .bpmnProcessId("loop-test")
                .latestVersion()
                .send()
                .join();
        long processInstanceKey = loopTestInstance.getProcessInstanceKey();
        assertThatUserTask(byTaskName("Akcja użytkownika")).isCreated();
        processTestContext.completeUserTask(byTaskName("Akcja użytkownika"), Map.of("ponowienie", ponowienie));

        assertThatUserTask(byTaskName("Akcja użytkownika")).isCompleted();
        if (ponowienie){
            long akcjaUzytkownikaInstanceKey= assertNewUserTaskCreated(processInstanceKey, "Akcja użytkownika");
            processTestContext.completeUserTask(byUserTaskInstanceKey(akcjaUzytkownikaInstanceKey),
                    Map.of("ponowienie", false));
            assertThatUserTask(byUserTaskInstanceKey(akcjaUzytkownikaInstanceKey)).isCompleted();
        }

        assertThat(loopTestInstance).isCompleted();

    }

    private static @NotNull UserTaskSelector byUserTaskInstanceKey(long userTaskInstanceKey) {
        return userTask -> userTask.getElementInstanceKey() == userTaskInstanceKey;
    }

    long assertNewUserTaskCreated(final long processInstanceKey, final String userTaskName) {
        final AtomicReference<Long> elementInstanceKeyRef = new AtomicReference<>();
        Awaitility.await()
                .ignoreException(ClientException.class)
                .untilAsserted(
                        () -> {
                            final List<UserTask> userTasks = getUserTasks(processInstanceKey);
                            Assertions.assertFalse(userTasks.isEmpty());
                            final UserTask userTask = userTasks.getFirst();
                            Assertions.assertEquals(userTaskName, userTask.getName());
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
}
