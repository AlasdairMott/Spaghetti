// KiCad symbol instance templates extracted from the Example reference project.
// These are full symbol placements (with Reference, Value, Footprint,
// Datasheet properties, pin UUIDs, and a project instance block) ready to
// be customised per-placement. The lib_id in each template is a placeholder
// that gets replaced at export time with the user's configured symbol ID.
//
// \${...} and \" sequences are escaped so TS template literals don't process them.

export const POT_INSTANCE = `
	(symbol
		(lib_id "PLACEHOLDER")
		(at 36.83 30.48 0)
		(unit 1)
		(exclude_from_sim no)
		(in_bom yes)
		(on_board yes)
		(dnp no)
		(fields_autoplaced yes)
		(uuid "29f5056a-24ac-4423-8d78-bf87fef7925f")
		(property "Reference" "RV1"
			(at 34.29 29.2099 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify right)
			)
		)
		(property "Value" "Freq"
			(at 34.29 31.7499 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify right)
			)
		)
		(property "Footprint" ""
			(at 36.83 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Datasheet" "~"
			(at 36.83 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Description" "Potentiometer"
			(at 36.83 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(pin "1"
			(uuid "28421409-cd54-48e1-a545-7db616ace10e")
		)
		(pin "3"
			(uuid "0e32944f-7fdf-47ed-9111-4bb6c4fedcd6")
		)
		(pin "2"
			(uuid "dce43fd8-6f60-4d20-8064-74fc04bfa187")
		)
		(instances
			(project "Example"
				(path "/c3c83fb9-eca4-4353-bbe3-406683e5d6d9"
					(reference "RV1")
					(unit 1)
				)
			)
		)
	)
`;

export const JACK_INSTANCE = `
	(symbol
		(lib_id "PLACEHOLDER")
		(at 64.77 27.94 0)
		(mirror x)
		(unit 1)
		(exclude_from_sim no)
		(in_bom yes)
		(on_board yes)
		(dnp no)
		(uuid "a0700a63-aa5f-408c-b60f-83245abc99bc")
		(property "Reference" "J2"
			(at 64.135 36.83 0)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Value" "Trigger"
			(at 64.135 34.29 0)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Footprint" ""
			(at 64.77 27.94 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Datasheet" "~"
			(at 64.77 27.94 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Description" "Audio Jack, 2 Poles (Mono / TS), Switched T Pole (Normalling)"
			(at 64.77 27.94 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(pin "T"
			(uuid "14eeb89e-a38c-413f-8be5-db14f36b3267")
		)
		(pin "TN"
			(uuid "7f02d8c8-24eb-4164-ab56-d1edd17d36a1")
		)
		(pin "S"
			(uuid "e47b2f34-dc33-4e9a-985a-e63c2ea387e0")
		)
		(instances
			(project "Example"
				(path "/c3c83fb9-eca4-4353-bbe3-406683e5d6d9"
					(reference "J2")
					(unit 1)
				)
			)
		)
	)
`;

export const BUTTON_INSTANCE = `
	(symbol
		(lib_id "PLACEHOLDER")
		(at 107.95 30.48 0)
		(unit 1)
		(exclude_from_sim no)
		(in_bom yes)
		(on_board yes)
		(dnp no)
		(fields_autoplaced yes)
		(uuid "a2bcb26b-752f-4f24-8879-c77e2af6e701")
		(property "Reference" "S1"
			(at 107.95 20.32 0)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Value" "Button 1"
			(at 107.95 22.86 0)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Footprint" ""
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "Datasheet" ""
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Description" "Switch Tactile OFF (ON) SPST Round Button PC Pins 0.05A 24VDC 1.57N Thru-Hole"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "COMMENT" "1825967-2"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "MF" "TE Connectivity / AMP"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "PACKAGE" "None"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "PRICE" "None"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "MP" "1825967-2"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "EU_ROHS_COMPLIANCE" "Compliant"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "AVAILABILITY" "In Stock"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(property "PURCHASE-URL" "https://pricing.snapeda.com/search/part/1825967-2/?ref=eda"
			(at 107.95 30.48 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(justify bottom)
				(hide yes)
			)
		)
		(pin "3"
			(uuid "8d93bf38-ccb8-4911-9b9c-b2ca289cd1d5")
		)
		(pin "4"
			(uuid "d1024e67-dfee-4c30-a22e-a0fdef52b864")
		)
		(pin "2"
			(uuid "b20219ec-3319-4389-b4dc-2efdcdbe0465")
		)
		(pin "1"
			(uuid "a8583695-bd8a-4198-8d2e-571f7b8489aa")
		)
		(instances
			(project "Example"
				(path "/c3c83fb9-eca4-4353-bbe3-406683e5d6d9"
					(reference "S1")
					(unit 1)
				)
			)
		)
	)
`;

export const R_INSTANCE = `
	(symbol
		(lib_id "PLACEHOLDER")
		(at 63.5 54.61 90)
		(unit 1)
		(exclude_from_sim no)
		(in_bom yes)
		(on_board yes)
		(dnp no)
		(fields_autoplaced yes)
		(uuid "44050044-af2f-497f-9b07-b242934cf705")
		(property "Reference" "R1"
			(at 63.5 48.26 90)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Value" "1kΩ"
			(at 63.5 50.8 90)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Footprint" ""
			(at 63.5 56.388 90)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Datasheet" "~"
			(at 63.5 54.61 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Description" "Resistor"
			(at 63.5 54.61 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(pin "1"
			(uuid "db460bbd-e639-4635-b18e-3d7932d27147")
		)
		(pin "2"
			(uuid "98a71236-1544-4dea-a05a-a87850a20248")
		)
		(instances
			(project "Example"
				(path "/c3c83fb9-eca4-4353-bbe3-406683e5d6d9"
					(reference "R1")
					(unit 1)
				)
			)
		)
	)
`;

export const LED_INSTANCE = `
	(symbol
		(lib_id "PLACEHOLDER")
		(at 71.12 54.61 180)
		(unit 1)
		(exclude_from_sim no)
		(in_bom yes)
		(on_board yes)
		(dnp no)
		(fields_autoplaced yes)
		(uuid "51b61c74-8fdf-4dbf-b917-275889b0e93e")
		(property "Reference" "D1"
			(at 72.7075 46.99 0)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Value" "LED"
			(at 72.7075 49.53 0)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Footprint" ""
			(at 71.12 54.61 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Datasheet" "~"
			(at 71.12 54.61 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Description" "Light emitting diode"
			(at 71.12 54.61 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Sim.Pins" "1=K 2=A"
			(at 71.12 54.61 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(pin "2"
			(uuid "e0c3ad1a-d75b-4f39-afbc-e97a12d5cd13")
		)
		(pin "1"
			(uuid "f7f541c9-6c38-4c05-ab0f-6d5e6734fb6d")
		)
		(instances
			(project "Example"
				(path "/c3c83fb9-eca4-4353-bbe3-406683e5d6d9"
					(reference "D1")
					(unit 1)
				)
			)
		)
	)
`;

export const GND_INSTANCE = `
	(symbol
		(lib_id "power:GND")
		(at 36.83 35.56 0)
		(unit 1)
		(exclude_from_sim no)
		(in_bom yes)
		(on_board yes)
		(dnp no)
		(fields_autoplaced yes)
		(uuid "a62b94ba-407c-4a33-ad91-cca7f962b6f4")
		(property "Reference" "#PWR01"
			(at 36.83 41.91 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Value" "GND"
			(at 36.83 40.64 0)
			(effects
				(font
					(size 1.27 1.27)
				)
			)
		)
		(property "Footprint" ""
			(at 36.83 35.56 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Datasheet" ""
			(at 36.83 35.56 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(property "Description" "Power symbol creates a global label with name \\"GND\\" , ground"
			(at 36.83 35.56 0)
			(effects
				(font
					(size 1.27 1.27)
				)
				(hide yes)
			)
		)
		(pin "1"
			(uuid "450529d7-3afc-4ff8-b5a7-b889abbc5a40")
		)
		(instances
			(project "Example"
				(path "/c3c83fb9-eca4-4353-bbe3-406683e5d6d9"
					(reference "#PWR01")
					(unit 1)
				)
			)
		)
	)
`;
