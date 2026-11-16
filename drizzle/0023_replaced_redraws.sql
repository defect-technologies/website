-- Nov 16, 2026: the boards redrawn on Nov 15 and 16 because the system changed carried a note written by Claude under
-- Boris's name, so they read as his taste. Redraw all now records them as "replaced" with no words; these become the same.
UPDATE "design_boards" SET "chosen_letter" = 'replaced', "feedback" = ''
WHERE "chosen_letter" = 'redrawn' AND "feedback" IN (
  'Drawn again with the current system. These were made before each page was checked against DESIGN.md (capitals, letter-spacing, overlaps, tall photos) and before fonts were matched to the logo''s own lettering.',
  'Drawn again: the first draw ran before the fonts were compared with the logo''s own lettering.'
);
