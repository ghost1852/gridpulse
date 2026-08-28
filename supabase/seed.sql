-- Seed data for popular Forza Horizon cars
-- NOTE: The ordinals here are placeholders for demonstration.
-- Real Forza telemetry will provide actual ordinals.

INSERT INTO public.cars (ordinal, name, manufacturer, year, default_class, default_pi, drivetrain, game) VALUES
(117, 'Skyline GT-R V-Spec II', 'Nissan', 2002, 'B', 655, 'AWD', 'FH5'),
(118, 'Supra RZ', 'Toyota', 1998, 'B', 649, 'RWD', 'FH5'),
(119, 'RX-7 Spirit R Type-A', 'Mazda', 2002, 'B', 635, 'RWD', 'FH5'),
(120, 'Lancer Evolution VIII MR', 'Mitsubishi', 2004, 'B', 660, 'AWD', 'FH5'),
(121, 'Impreza WRX STi', 'Subaru', 2004, 'B', 658, 'AWD', 'FH5'),
(122, 'S2000 CR', 'Honda', 2009, 'B', 645, 'RWD', 'FH5'),
(123, 'Mustang GT', 'Ford', 2018, 'A', 750, 'RWD', 'FH5'),
(124, 'Camaro ZL1 1LE', 'Chevrolet', 2018, 'S1', 820, 'RWD', 'FH5'),
(125, 'Challenger SRT Demon', 'Dodge', 2018, 'A', 785, 'RWD', 'FH5'),
(126, 'Corvette ZR1', 'Chevrolet', 2019, 'S1', 865, 'RWD', 'FH5'),
(127, 'Viper ACR', 'Dodge', 2016, 'S1', 880, 'RWD', 'FH5'),
(128, 'Ford GT', 'Ford', 2017, 'S1', 860, 'RWD', 'FH5'),
(129, '911 GT2 RS', 'Porsche', 2018, 'S1', 885, 'RWD', 'FH5'),
(130, '488 Pista', 'Ferrari', 2019, 'S1', 890, 'RWD', 'FH5'),
(131, 'Huracán Performante', 'Lamborghini', 2018, 'S1', 895, 'AWD', 'FH5'),
(132, '720S Coupe', 'McLaren', 2018, 'S1', 885, 'RWD', 'FH5'),
(133, 'Senna', 'McLaren', 2018, 'S2', 960, 'RWD', 'FH5'),
(134, 'Centenario LP 770-4', 'Lamborghini', 2016, 'S2', 965, 'AWD', 'FH5'),
(135, 'LaFerrari', 'Ferrari', 2013, 'S2', 960, 'RWD', 'FH5'),
(136, '918 Spyder', 'Porsche', 2014, 'S2', 955, 'AWD', 'FH5'),
(137, 'Chiron', 'Bugatti', 2018, 'S2', 980, 'AWD', 'FH5'),
(138, 'Jesko', 'Koenigsegg', 2020, 'S2', 995, 'RWD', 'FH5'),
(139, 'AMG ONE', 'Mercedes-AMG', 2021, 'S2', 998, 'AWD', 'FH5'),
(140, 'Bronco', 'Ford', 2021, 'C', 550, 'AWD', 'FH5');
