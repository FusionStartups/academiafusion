
-- Corrección 1: errata en Módulo 2 / Lección 3
UPDATE public.lessons
SET content = REPLACE(
  content,
  'Si no sabes qué respuesta desmentirla tu hipótesis',
  'Si no sabes qué respuesta desmentirá tu hipótesis'
)
WHERE module_id IN (
  SELECT m.id FROM public.modules m
  JOIN public.courses c ON c.id = m.course_id
  WHERE c.slug = 'diseno-entrevistas-usuario' AND m.sort_order = 2
)
AND sort_order = 3;

-- Corrección 2: terminología en Módulo 1 / Lección 1
UPDATE public.lessons
SET content = REPLACE(
  content,
  'Piensa en la última conversación que tuviste con un usuario o cliente potencial',
  'Piensa en la última conversación que tuviste con un usuario potencial'
)
WHERE module_id IN (
  SELECT m.id FROM public.modules m
  JOIN public.courses c ON c.id = m.course_id
  WHERE c.slug = 'diseno-entrevistas-usuario' AND m.sort_order = 1
)
AND sort_order = 1;

-- Corrección 3: añadir frase de anclaje en Módulo 3 / Lección 4
UPDATE public.lessons
SET content = REPLACE(
  content,
  '<p>No las vas a hacer todas — son un banco al que acudir cuando una respuesta genera señal y quieres profundizar. Incluye al menos:</p>',
  '<p>No las vas a hacer todas — son un banco al que acudir cuando una respuesta genera señal y quieres profundizar. Incluye al menos:</p> <p>Son las mismas que trabajaste en la lección anterior — aquí las tienes reunidas para que el guión sea autocontenido.</p>'
)
WHERE module_id IN (
  SELECT m.id FROM public.modules m
  JOIN public.courses c ON c.id = m.course_id
  WHERE c.slug = 'diseno-entrevistas-usuario' AND m.sort_order = 3
)
AND sort_order = 4;
