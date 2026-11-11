/* Catálogos editoriales de ayuda a la carga. No prueban compatibilidad ni diagnostican.
 * Listas abiertas: la interfaz debe admitir escribir otra opción y dejar datos sin confirmar.
 * Elegir una sugerencia nunca autoriza, realiza ni verifica un trabajo.
 * Fuentes y límites: ../referencias/fuentes-catalogos.md.
 */
window.TALLERES_CATALOGOS = {
  version: '2026-10-19',
  marcas: ['Toyota', 'Volkswagen', 'Renault', 'Ford', 'Chevrolet', 'Fiat', 'Peugeot', 'Citroën', 'Nissan', 'Honda', 'Hyundai', 'Kia', 'Suzuki', 'Mitsubishi', 'Jeep', 'Dodge', 'Mercedes-Benz', 'BMW', 'Audi', 'Chery', 'Haval', 'BAIC', 'BYD', 'DFSK', 'JAC', 'Lifan', 'Geely', 'Volvo', 'Subaru'],
  // Sugerencias iniciales, no catálogo completo ni ranking de frecuencia del taller.
  modelos: {
    Toyota: ['Etios', 'Yaris', 'Corolla', 'Corolla Cross', 'Hilux', 'SW4', 'RAV4', 'Hiace'],
    Volkswagen: ['Gol', 'Gol Trend', 'Polo', 'Virtus', 'Fox', 'Suran', 'Voyage', 'Bora', 'Vento', 'Golf', 'Saveiro', 'Amarok', 'T-Cross', 'Nivus', 'Taos'],
    Renault: ['Clio', 'Sandero', 'Stepway', 'Logan', 'Kangoo', 'Duster', 'Oroch', 'Alaskan', 'Kwid', 'Fluence', 'Mégane'],
    Ford: ['Ka', 'Fiesta', 'Focus', 'EcoSport', 'Ranger', 'Kuga', 'Mondeo', 'Transit'],
    Chevrolet: ['Corsa', 'Classic', 'Celta', 'Agile', 'Onix', 'Prisma', 'Cruze', 'Tracker', 'Spin', 'S10', 'Montana'],
    Fiat: ['Uno', 'Palio', 'Siena', 'Grand Siena', 'Punto', 'Argo', 'Cronos', 'Fiorino', 'Strada', 'Toro', 'Ducato', 'Idea'],
    Peugeot: ['206', '207 Compact', '208', '307', '308', '408', '2008', '3008', 'Partner', 'Expert', 'Boxer'],
    'Citroën': ['C3', 'C3 Aircross', 'C4', 'C4 Lounge', 'C4 Cactus', 'Berlingo', 'Jumpy', 'Jumper'],
    Nissan: ['March', 'Note', 'Tiida', 'Versa', 'Sentra', 'Kicks', 'Frontier', 'X-Trail'],
    Honda: ['Fit', 'City', 'Civic', 'Accord', 'HR-V', 'CR-V', 'WR-V'],
    Hyundai: ['i10', 'i20', 'i30', 'HB20', 'Creta', 'Tucson', 'Santa Fe', 'H-1'],
    Kia: ['Picanto', 'Rio', 'Cerato', 'Soul', 'Sportage', 'Sorento', 'Carnival'],
    Suzuki: ['Fun', 'Swift', 'Baleno', 'Vitara', 'Grand Vitara', 'Jimny'],
    Mitsubishi: ['Lancer', 'L200', 'Montero', 'Outlander', 'ASX'],
    Jeep: ['Renegade', 'Compass', 'Commander', 'Cherokee', 'Grand Cherokee', 'Wrangler'],
    Dodge: ['Journey', 'Caliber', 'Caravan', 'Durango'],
    'Mercedes-Benz': ['Clase A', 'Clase B', 'Clase C', 'Clase E', 'GLA', 'GLC', 'Sprinter', 'Vito'],
    BMW: ['Serie 1', 'Serie 2', 'Serie 3', 'Serie 5', 'X1', 'X3', 'X5'],
    Audi: ['A1', 'A3', 'A4', 'A5', 'A6', 'Q2', 'Q3', 'Q5', 'Q7'],
    Chery: ['QQ', 'Face', 'Fulwin', 'Tiggo', 'Tiggo 2', 'Tiggo 3', 'Tiggo 4', 'Tiggo 7', 'Tiggo 8'],
    Haval: ['H1', 'H2', 'H6', 'Jolion'],
    BAIC: ['X25', 'X35', 'X55', 'BJ40'],
    BYD: ['F0', 'F3', 'Dolphin', 'Yuan', 'Song'],
    DFSK: ['C31', 'C32', 'C35', 'Glory 580'],
    JAC: ['S2', 'S3', 'S5', 'T6', 'T8'],
    Lifan: ['320', '520', '620', 'X50', 'X60', 'Foison'],
    Geely: ['LC', '515', 'Emgrand', 'GX3', 'Coolray'],
    Volvo: ['C30', 'S40', 'S60', 'S80', 'V40', 'XC40', 'XC60', 'XC90'],
    Subaru: ['Impreza', 'Legacy', 'Outback', 'Forester', 'XV']
  },
  combustibles: ['Nafta', 'Diésel / gasoil', 'Nafta y GNC', 'Nafta y GLP', 'Flex (nafta / etanol)', 'Híbrido', 'Híbrido enchufable', 'Eléctrico', 'A confirmar'],
  cajas: ['Manual', 'Automática', 'CVT', 'Doble embrague', 'Robotizada', 'A confirmar'],
  carrocerias: ['Hatchback', 'Sedán', 'Rural', 'SUV / crossover', 'Pick-up', 'Furgón', 'Utilitario de pasajeros', 'Coupé', 'A confirmar'],
  colores: ['Blanco', 'Negro', 'Gris', 'Plata', 'Rojo', 'Azul', 'Verde', 'Bordó', 'Beige', 'Marrón', 'Amarillo', 'Naranja', 'A confirmar'],
  motivos: ['Service / mantenimiento', 'Revisión general', 'Ruido o golpe', 'Vibración', 'No arranca', 'Le cuesta arrancar', 'Se apaga', 'Tironea o pierde fuerza', 'Regula desparejo', 'Pierde aceite', 'Consume aceite', 'Pierde refrigerante', 'Levanta temperatura', 'Frena mal o hace ruido al frenar', 'Problema de dirección', 'Problema de embrague o cambios', 'Luz encendida en el tablero', 'Humo u olor inusual', 'Vuelve por el mismo problema'],
  condiciones: ['Al arrancar', 'Con el motor frío', 'Con el motor caliente', 'En ralentí', 'Al acelerar', 'Al frenar', 'Al doblar', 'Al pasar un pozo o lomo de burro', 'En ruta', 'En ciudad', 'Con el aire acondicionado', 'Con carga', 'Siempre', 'A veces', 'Después de un trabajo anterior', 'Todavía sin precisar'],
  ubicaciones: ['Delantero', 'Trasero', 'Delantero izquierdo', 'Delantero derecho', 'Trasero izquierdo', 'Trasero derecho', 'Ambos lados delanteros', 'Ambos lados traseros', 'Motor', 'Caja de cambios', 'Debajo del auto', 'Habitáculo', 'Sin ubicación confirmada'],
  metodosControl: ['Inspección visual', 'Prueba de ruta', 'Revisión en elevador', 'Prueba en ralentí', 'Prueba de arranque', 'Lectura de escáner', 'Medición con instrumento', 'Prueba de pérdidas / estanqueidad', 'Prueba de funcionamiento del sistema', 'Comparación antes y después', 'Otra forma (detallar abajo)'],
  sistemas: [
    {
      id: 'service', nombre: 'Service y filtros',
      componentes: ['Filtro de aceite', 'Filtro de aire', 'Filtro de combustible', 'Filtro de habitáculo / antipolen', 'Tapón de cárter', 'Arandela de tapón de cárter'],
      trabajos: ['Cambio de aceite y filtro', 'Cambio de filtro de aire', 'Cambio de filtro de combustible', 'Cambio de filtro de habitáculo', 'Control general de service', 'Control de niveles y pérdidas'],
      sintomas: ['Service / mantenimiento', 'Antecedentes de mantenimiento desconocidos', 'Nivel bajo de un fluido']
    },
    {
      id: 'motor', nombre: 'Motor y pérdidas',
      componentes: ['Junta de tapa de válvulas', 'Junta de tapa de cilindros', 'Junta de cárter', 'Junta de admisión', 'Junta de escape', 'Retén de cigüeñal', 'Retén de árbol de levas', 'Soporte de motor', 'Soporte de caja', 'Bomba de aceite', 'Bulbo / sensor de presión de aceite'],
      trabajos: ['Revisión de pérdida de aceite', 'Cambio de junta o retén', 'Cambio de soporte de motor o caja', 'Medición de compresión', 'Medición de presión de aceite', 'Revisión mecánica del motor'],
      sintomas: ['Pierde aceite', 'Consume aceite', 'Golpe o ruido en el motor', 'Vibra el motor', 'Humo por el escape', 'Luz de presión de aceite encendida']
    },
    {
      id: 'distribucion', nombre: 'Distribución y correas',
      componentes: ['Correa de distribución', 'Kit de distribución', 'Cadena de distribución', 'Kit de cadena de distribución', 'Tensor de distribución', 'Polea guía', 'Correa de accesorios / poly-V', 'Tensor de accesorios', 'Polea de cigüeñal / damper', 'Polea de alternador'],
      trabajos: ['Revisión de distribución', 'Cambio de kit de distribución', 'Revisión de cadena de distribución', 'Cambio de kit de cadena de distribución', 'Cambio de correa de accesorios', 'Cambio de tensor o polea'],
      sintomas: ['Ruido en zona de distribución', 'Chillido de correa', 'Correa con daño visible', 'Antecedente de distribución desconocido']
    },
    {
      id: 'refrigeracion', nombre: 'Refrigeración del motor',
      componentes: ['Bomba de agua', 'Termostato', 'Carcasa de termostato', 'Radiador', 'Electroventilador', 'Depósito de refrigerante', 'Tapa de depósito / radiador', 'Manguera de refrigeración', 'Abrazadera', 'Sensor de temperatura', 'Radiador de calefacción'],
      trabajos: ['Prueba de pérdidas de refrigeración', 'Cambio de bomba de agua', 'Cambio de termostato', 'Cambio de radiador o manguera', 'Cambio de refrigerante y purga', 'Control de electroventilador'],
      sintomas: ['Levanta temperatura', 'Pierde refrigerante', 'Baja el nivel de refrigerante', 'No enciende el electroventilador', 'La calefacción no calienta', 'Temperatura irregular']
    },
    {
      id: 'encendido', nombre: 'Encendido e inyección',
      componentes: ['Bujía', 'Cable de bujía', 'Bobina de encendido', 'Inyector', 'Bomba de combustible', 'Cuerpo de mariposa', 'Sensor MAP', 'Sensor MAF / caudalímetro', 'Sonda lambda', 'Sensor de cigüeñal', 'Sensor de árbol de levas', 'Bujía de precalentamiento diésel'],
      trabajos: ['Revisión de falla de motor', 'Cambio de bujías', 'Cambio de cable o bobina', 'Revisión de alimentación de combustible', 'Revisión de inyectores', 'Revisión de cuerpo de mariposa'],
      sintomas: ['No arranca', 'Le cuesta arrancar', 'Tironea', 'Pierde fuerza', 'Regula desparejo', 'Se apaga', 'Luz de motor encendida']
    },
    {
      id: 'frenos', nombre: 'Frenos',
      componentes: ['Pastillas de freno', 'Disco de freno', 'Cinta / zapata de freno', 'Campana de freno', 'Cilindro de rueda', 'Bomba de freno', 'Servofreno', 'Cáliper / pinza de freno', 'Flexible de freno', 'Cable de freno de mano', 'Sensor ABS'],
      trabajos: ['Control del sistema de frenos', 'Cambio de pastillas', 'Cambio de discos', 'Cambio de cintas o cilindros', 'Cambio de líquido de frenos y purga', 'Revisión de freno de mano'],
      sintomas: ['Ruido al frenar', 'Vibra al frenar', 'Pedal bajo o esponjoso', 'Pedal duro', 'Se desvía al frenar', 'Freno de mano con poco efecto', 'Luz de frenos / ABS encendida']
    },
    {
      id: 'suspension', nombre: 'Suspensión',
      componentes: ['Amortiguador', 'Espiral / resorte', 'Cazoleta de amortiguador', 'Rodamiento de cazoleta', 'Tope de amortiguador', 'Fuelle de amortiguador', 'Buje de suspensión', 'Parrilla / brazo de suspensión', 'Rótula de suspensión', 'Bieleta', 'Buje de barra estabilizadora'],
      trabajos: ['Revisión de suspensión en elevador', 'Cambio de amortiguadores', 'Cambio de cazoleta, tope o fuelle', 'Cambio de buje o parrilla', 'Cambio de rótula o bieleta'],
      sintomas: ['Golpe al pasar un pozo', 'Rebota demasiado', 'Queda inclinado', 'Crujido en suspensión', 'Desgaste irregular de neumáticos']
    },
    {
      id: 'direccion', nombre: 'Dirección',
      componentes: ['Extremo de dirección', 'Axial de dirección', 'Cremallera de dirección', 'Fuelle de cremallera', 'Bomba de dirección hidráulica', 'Manguera de dirección'],
      trabajos: ['Revisión de juego de dirección', 'Cambio de extremo o axial', 'Cambio de fuelle de dirección', 'Revisión de pérdida de dirección hidráulica'],
      sintomas: ['Dirección dura', 'Juego en el volante', 'Ruido al doblar', 'Se va hacia un lado', 'Pierde líquido de dirección']
    },
    {
      id: 'transmision', nombre: 'Embrague y transmisión',
      componentes: ['Kit de embrague', 'Disco de embrague', 'Placa de embrague', 'Rulemán de empuje', 'Bombín de embrague', 'Bomba de embrague', 'Cable de embrague', 'Volante de motor', 'Semieje', 'Junta homocinética', 'Triceta', 'Fuelle de semieje'],
      trabajos: ['Revisión de embrague', 'Cambio de kit de embrague', 'Cambio de comando de embrague', 'Cambio de homocinética o fuelle', 'Revisión de pérdida de caja'],
      sintomas: ['Patina el embrague', 'Cuesta poner los cambios', 'Ruido al pisar embrague', 'Pedal de embrague anormal', 'Ruido al doblar y acelerar', 'Pierde aceite de caja']
    },
    {
      id: 'ruedas', nombre: 'Ruedas y rodamientos',
      componentes: ['Rulemán / rodamiento de rueda', 'Maza / cubo de rueda', 'Bulón de rueda', 'Tuerca de rueda', 'Válvula de neumático', 'Neumático'],
      trabajos: ['Control de ruedas y neumáticos', 'Revisión de rodamiento de rueda', 'Cambio de rodamiento o maza', 'Control de presión de neumáticos'],
      sintomas: ['Zumbido al circular', 'Vibración al circular', 'Juego en la rueda', 'Neumático con desgaste irregular', 'Pérdida de presión']
    },
    {
      id: 'escape', nombre: 'Admisión y escape',
      componentes: ['Manguera de admisión', 'Manguera de vacío', 'Múltiple de escape', 'Caño de escape', 'Silenciador', 'Flexible de escape', 'Soporte de escape', 'Catalizador'],
      trabajos: ['Revisión de admisión', 'Revisión de escape y soportes', 'Cambio de manguera de admisión o vacío', 'Reparación de escape a evaluar'],
      sintomas: ['Ruido de escape', 'Olor a gases', 'Escape golpea debajo del auto', 'Silbido en la admisión']
    },
    {
      id: 'electricidad-basica', nombre: 'Electricidad básica y visibilidad',
      componentes: ['Batería', 'Borne de batería', 'Cable de masa', 'Fusible', 'Relé', 'Lámpara', 'Escobilla limpiaparabrisas', 'Bomba lavaparabrisas', 'Alternador', 'Burro / motor de arranque'],
      trabajos: ['Control de batería y carga', 'Revisión de arranque', 'Cambio de batería o borne', 'Cambio de lámpara o fusible', 'Cambio de escobillas'],
      sintomas: ['Arranque lento', 'No gira el motor al arrancar', 'Se descarga la batería', 'Luz de batería encendida', 'Lámpara que no funciona', 'Limpiaparabrisas no limpia bien']
    }
  ],
  productos: [
    {nombre: 'Aceite de motor', grupo: 'Lubricantes'},
    {nombre: 'Aceite de caja manual', grupo: 'Lubricantes'},
    {nombre: 'Fluido de caja automática / CVT', grupo: 'Lubricantes'},
    {nombre: 'Aceite de diferencial', grupo: 'Lubricantes'},
    {nombre: 'Fluido de dirección hidráulica', grupo: 'Fluidos'},
    {nombre: 'Líquido de frenos', grupo: 'Fluidos'},
    {nombre: 'Refrigerante', grupo: 'Fluidos'},
    {nombre: 'Agua desmineralizada', grupo: 'Fluidos'},
    {nombre: 'Líquido lavaparabrisas', grupo: 'Fluidos'},
    {nombre: 'Grasa específica', grupo: 'Lubricantes'},
    {nombre: 'Limpiador de frenos', grupo: 'Insumos'},
    {nombre: 'Limpiador de piezas', grupo: 'Insumos'},
    {nombre: 'Sellador / formador de juntas', grupo: 'Insumos'},
    {nombre: 'Filtro de aceite', grupo: 'Filtros'},
    {nombre: 'Filtro de aire', grupo: 'Filtros'},
    {nombre: 'Filtro de combustible', grupo: 'Filtros'},
    {nombre: 'Filtro de habitáculo / antipolen', grupo: 'Filtros'}
  ],
  // Etiquetas comunes de viscosidad. No sustituyen la norma/homologación ni el manual.
  viscosidades: ['0W-16', '0W-20', '0W-30', '0W-40', '5W-20', '5W-30', '5W-40', '10W-30', '10W-40', '15W-40', '20W-50']
};
