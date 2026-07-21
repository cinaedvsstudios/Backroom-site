(() => {
  'use strict';
  const target = window.BRHeatCityCoordinates = window.BRHeatCityCoordinates || [];
  [
    ['Tel Aviv','Israel',32.0853,34.7818],
    ['Tel Aviv-Yafo','Israel',32.0853,34.7818],
    ['Tel Aviv-Jaffa','Israel',32.0853,34.7818],
    ['Tel Aviv / Jaffa','Israel',32.0853,34.7818],
    ['Jerusalem','Israel',31.7683,35.2137],
    ['Haifa','Israel',32.7940,34.9896],
    ['Eilat','Israel',29.5577,34.9519],
    ['Beersheba','Israel',31.2520,34.7915]
  ].forEach(([city,country,lat,lng]) => target.push({ city, country, lat, lng }));
})();
