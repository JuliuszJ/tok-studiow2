package pl.dziekanat.zaliczenie_semestru_srv;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

public class JsonSerializationService {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static String serializeMapToJson(Map<String, Object> dataMap) {
        try {
            return OBJECT_MAPPER.writeValueAsString(dataMap);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Nie udało się zserializować Mapy do JSON", e);
        }
    }
}
