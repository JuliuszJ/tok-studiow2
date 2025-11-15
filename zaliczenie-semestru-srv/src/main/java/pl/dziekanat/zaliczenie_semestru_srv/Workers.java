package pl.dziekanat.zaliczenie_semestru_srv;
import io.camunda.client.annotation.JobWorker;
import io.camunda.client.annotation.Variable;
import static pl.dziekanat.zaliczenie_semestru_srv.JsonSerializationService.*;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class Workers {
    private final static Logger LOG = LoggerFactory.getLogger(Workers.class);
    @JobWorker(type = "rejestracja-odwolania")
    public Map<String, Object> rejestracjaOdwolania(
            @Variable("podanie") Map<String, Object> podanie,
            @Variable("decyzja") Map<String, Object> decyzja) {
        LOG.info("rejestracja odwołania, podanie - {}, decyzja - {}",
                serializeMapToJson(podanie), serializeMapToJson(decyzja));
        podanie.put("rejestracjaOdwolania", true);
        return Map.of("podanie", podanie);
    }
}
