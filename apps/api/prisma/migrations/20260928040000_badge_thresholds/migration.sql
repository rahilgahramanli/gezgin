-- "Region Kəşfçisi" 10 region tələb edirdi, platformada isə 7 region var — badge qazanılmaz idi.
UPDATE `badges` SET `condition_value` = 5, `description_az` = '5 region kəşf et' WHERE `slug` = 'region-kesfcisi';
-- "Fotoqu" yalnız foto/video paylaşımlarını sayır
UPDATE `badges` SET `description_az` = '50 foto və ya video paylaşımı et' WHERE `slug` = 'fotoqu';
