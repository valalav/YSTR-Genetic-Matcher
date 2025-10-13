-- Исправление панелей маркеров согласно FTDNA order
-- Y12 = 11 уникальных маркеров (позиции 1-11) = 12 значений с палиндромами
-- Y37 = 30 уникальных маркеров (позиции 1-30) = 37 значений с палиндромами
-- Y67 = 58 уникальных маркеров (позиции 1-58) = 67 значений с палиндромами
-- Y111 = 102 уникальных маркера (позиции 1-102) = 111 значений с палиндромами

-- Удаляем неправильную панель Y25
DELETE FROM marker_panels WHERE panel_size = 25;

-- Обновляем Y12 (убираем DYS458 - это позиция 12, относится к Y37)
UPDATE marker_panels
SET markers = ARRAY[
  'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385',
  'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392',
  'DYS389ii'
]
WHERE panel_size = 12;

-- Обновляем Y37 (только позиции 1-30)
UPDATE marker_panels
SET markers = ARRAY[
  'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385',
  'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392',
  'DYS389ii', 'DYS458', 'DYS459', 'DYS455', 'DYS454',
  'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464',
  'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607',
  'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438'
]
WHERE panel_size = 37;

-- Обновляем Y67 (позиции 1-58)
UPDATE marker_panels
SET markers = ARRAY[
  'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385',
  'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392',
  'DYS389ii', 'DYS458', 'DYS459', 'DYS455', 'DYS454',
  'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464',
  'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607',
  'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438',
  'DYS531', 'DYS578', 'DYF395S1', 'DYS590', 'DYS537',
  'DYS641', 'DYS472', 'DYF406S1', 'DYS511', 'DYS425',
  'DYS413', 'DYS557', 'DYS594', 'DYS436', 'DYS490',
  'DYS534', 'DYS450', 'DYS444', 'DYS481', 'DYS520',
  'DYS446', 'DYS617', 'DYS568', 'DYS487', 'DYS572',
  'DYS640', 'DYS492', 'DYS565'
]
WHERE panel_size = 67;

-- Обновляем Y111 (позиции 1-102)
UPDATE marker_panels
SET markers = ARRAY[
  'DYS393', 'DYS390', 'DYS19', 'DYS391', 'DYS385',
  'DYS426', 'DYS388', 'DYS439', 'DYS389i', 'DYS392',
  'DYS389ii', 'DYS458', 'DYS459', 'DYS455', 'DYS454',
  'DYS447', 'DYS437', 'DYS448', 'DYS449', 'DYS464',
  'DYS460', 'Y-GATA-H4', 'YCAII', 'DYS456', 'DYS607',
  'DYS576', 'DYS570', 'CDY', 'DYS442', 'DYS438',
  'DYS531', 'DYS578', 'DYF395S1', 'DYS590', 'DYS537',
  'DYS641', 'DYS472', 'DYF406S1', 'DYS511', 'DYS425',
  'DYS413', 'DYS557', 'DYS594', 'DYS436', 'DYS490',
  'DYS534', 'DYS450', 'DYS444', 'DYS481', 'DYS520',
  'DYS446', 'DYS617', 'DYS568', 'DYS487', 'DYS572',
  'DYS640', 'DYS492', 'DYS565', 'DYS710', 'DYS485',
  'DYS632', 'DYS495', 'DYS540', 'DYS714', 'DYS716',
  'DYS717', 'DYS505', 'DYS556', 'DYS549', 'DYS589',
  'DYS522', 'DYS494', 'DYS533', 'DYS636', 'DYS575',
  'DYS638', 'DYS462', 'DYS452', 'DYS445', 'Y-GATA-A10',
  'DYS463', 'DYS441', 'Y-GGAAT-1B07', 'DYS525', 'DYS712',
  'DYS593', 'DYS650', 'DYS532', 'DYS715', 'DYS504',
  'DYS513', 'DYS561', 'DYS552', 'DYS726', 'DYS635',
  'DYS587', 'DYS643', 'DYS497', 'DYS510', 'DYS434',
  'DYS461', 'DYS435'
]
WHERE panel_size = 111;

-- Проверяем результаты
SELECT panel_size, array_length(markers, 1) as marker_count
FROM marker_panels
ORDER BY panel_size;
