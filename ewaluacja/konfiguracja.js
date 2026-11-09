// Konfiguracja oceny — można edytować.
window.KONFIGURACJA = {
  // Progi sugerowanej oceny: minimalny % pokrycia konstrukcji wzorca.
  // Sprawdzane od góry; pierwszy spełniony próg wyznacza ocenę.
  progi: [
    { min: 90, ocena: '5,0' },
    { min: 80, ocena: '4,5' },
    { min: 70, ocena: '4,0' },
    { min: 60, ocena: '3,5' },
    { min: 50, ocena: '3,0' },
    { min: 0,  ocena: '2,0' },
  ],
  // Konstrukcje pokazywane informacyjnie, ale NIE liczone do pokrycia
  // (klucze widoczne po najechaniu na nazwę konstrukcji na stronie).
  nieliczone: [
    'dmn.hit.UNIQUE',
  ],
};
