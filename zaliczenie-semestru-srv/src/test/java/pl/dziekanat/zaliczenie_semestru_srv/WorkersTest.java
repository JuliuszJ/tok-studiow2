package pl.dziekanat.zaliczenie_semestru_srv;


import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;


public class WorkersTest {
    @Test
    public void rejestracjaOdwolania(){
        Workers workers = new Workers();
        Map<String, Object> podanieIn = new HashMap<>(Map.of(
                "nrAlbumu", "007",
                "punktyECTS", 15,
                "uzasadnienie", ""
        ));
        Map<String, Object> res = workers.rejestracjaOdwolania(podanieIn, null);
        Assertions.assertNotNull(res);
        Assertions.assertNotNull(res.get("podanie"));
        Assertions.assertInstanceOf(Map.class, res.get("podanie"));
        Map<String, Object> podanieOut= (Map<String, Object>) res.get("podanie");
        Assertions.assertNotNull(podanieOut.get("rejestracjaOdwolania"));
        Assertions.assertInstanceOf(Boolean.class, podanieOut.get("rejestracjaOdwolania"));
        Assertions.assertTrue((boolean) podanieOut.get("rejestracjaOdwolania"));
    }
}
