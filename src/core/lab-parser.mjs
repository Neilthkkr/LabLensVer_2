// --- LAB REFERENCE LIBRARY + RECORD-ASSEMBLY PARSER (v14) ---
// Groups: blood, sugar, chol, kidney, liver, thyroid, electro, vitamin, iron,
//         cardiac, inflam, coag, hormone, urine, protein, immuno, other
const STANDARD_RANGES = {
  // ---------- Qualitative Specialty Lab Tests ----------
  'qualitative hcg':{name:'Qualitative hCG (Pregnancy)',min:null,max:null,unit:'',group:'hormone',abbr:['hcg','pregnancy test','human chorionic gonadotropin']},
  'hiv 1/2 screen':{name:'HIV-1/2 Screen',min:null,max:null,unit:'',group:'immuno',abbr:['hiv','hiv-1','hiv-2','hiv screen']},
  'rapid covid-19':{name:'Rapid COVID-19',min:null,max:null,unit:'',group:'swab',abbr:['covid','covid-19','sars-cov-2','covid antigen']},
  'fecal occult blood':{name:'Fecal Occult Blood (FOBT/FIT)',min:null,max:null,unit:'',group:'other',abbr:['fobt','fit','occult blood']},
  'antinuclear antibody':{name:'Antinuclear Antibody (ANA)',min:null,max:null,unit:'',group:'immuno',abbr:['ana','ana screen','ana factor']},
  'urine nitrite':{name:'Urine Nitrite',min:null,max:null,unit:'',group:'urine',abbr:['nitrite','nitrites','urine nitrites']},
  'urine leukocyte esterase':{name:'Urine Leukocyte Esterase',min:null,max:null,unit:'',group:'urine',abbr:['leukocyte esterase','leukocytes','urine leukocytes']},
  // Serology / infectious-disease screens (result is a qualitative call, not a number)
  'malarial parasite':{name:'Malarial Parasite (MP) Smear',min:null,max:null,unit:'',group:'blood',abbr:['malaria parasite','mp smear','blood smear for malaria','plasmodium']},
  'malaria antigen':{name:'Malaria Antigen (Rapid)',min:null,max:null,unit:'',group:'blood',abbr:['malaria rdt','malaria rapid antigen','pf/pv antigen']},
  'dengue ns1 antigen':{name:'Dengue NS1 Antigen',min:null,max:null,unit:'',group:'blood',abbr:['dengue ns1','ns1 antigen']},
  'dengue igm antibody':{name:'Dengue IgM Antibody',min:null,max:null,unit:'',group:'blood',abbr:['dengue igm','dengue igm antibodies']},
  'dengue igg antibody':{name:'Dengue IgG Antibody',min:null,max:null,unit:'',group:'blood',abbr:['dengue igg','dengue igg antibodies']},
  'chikungunya igm antibody':{name:'Chikungunya IgM Antibody',min:null,max:null,unit:'',group:'blood',abbr:['chikungunya igm','chikungunya-igm antibody']},
  'widal test':{name:'Widal Test (Typhoid)',min:null,max:null,unit:'',group:'blood',abbr:['widal','s. typhi o','s. typhi h','salmonella typhi']},
  'hbsag':{name:'HBsAg (Hepatitis B Surface Antigen)',min:null,max:null,unit:'',group:'immuno',abbr:['hepatitis b surface antigen','hep b surface antigen']},
  'anti hcv':{name:'Anti-HCV Antibody',min:null,max:null,unit:'',group:'immuno',abbr:['anti-hcv','hepatitis c antibody','hcv antibody']},
  'vdrl':{name:'VDRL / RPR (Syphilis)',min:null,max:null,unit:'',group:'immuno',abbr:['rpr','venereal disease research laboratory','syphilis test']},
  'rheumatoid factor':{name:'Rheumatoid Factor (RA Factor)',min:null,max:null,unit:'IU/mL',group:'immuno',abbr:['ra factor','rf test']},
  'influenza a':{name:'Influenza A',min:null,max:null,unit:'',group:'swab',abbr:['flu a','influenza a antigen']},
  'influenza b':{name:'Influenza B',min:null,max:null,unit:'',group:'swab',abbr:['flu b','influenza b antigen']},
  // Blood banking
  'abo blood group':{name:'ABO Blood Group',min:null,max:null,unit:'',group:'blood',abbr:['blood group','abo group','abo grouping']},
  'rh factor':{name:'Rh Factor (Rh Typing)',min:null,max:null,unit:'',group:'blood',abbr:['rh type','rh typing','rhesus factor']},
  'direct coombs test':{name:'Direct Coombs Test (DAT)',min:null,max:null,unit:'',group:'blood',abbr:['dat','direct antiglobulin test']},
  'indirect coombs test':{name:'Indirect Coombs Test (ICT)',min:null,max:null,unit:'',group:'blood',abbr:['ict','indirect antiglobulin test']},
  // Urine macroscopy/microscopy (dipstick + sediment exam)
  'urine appearance':{name:'Urine Appearance',min:null,max:null,unit:'',group:'urine',abbr:['appearance','physical appearance']},
  'urine colour':{name:'Urine Colour',min:null,max:null,unit:'',group:'urine',abbr:['urine color','colour']},
  'urine ketones':{name:'Urine Ketones',min:null,max:null,unit:'',group:'urine',abbr:['ketone bodies','ketones']},
  'urine bilirubin':{name:'Urine Bilirubin',min:null,max:null,unit:'',group:'urine',abbr:['bile pigments']},
  'urine urobilinogen':{name:'Urine Urobilinogen',min:null,max:null,unit:'',group:'urine',abbr:['urobilinogen']},
  'urine pus cells':{name:'Urine Pus Cells (WBC/hpf)',min:0,max:5,unit:'/hpf',group:'urine',abbr:['pus cells','wbc/hpf','leucocytes hpf']},
  'urine rbc':{name:'Urine RBC (hpf)',min:0,max:2,unit:'/hpf',group:'urine',abbr:['rbc/hpf','red blood cells hpf']},
  'urine epithelial cells':{name:'Urine Epithelial Cells',min:null,max:null,unit:'/hpf',group:'urine',abbr:['epithelial cells']},
  'urine casts':{name:'Urine Casts',min:null,max:null,unit:'',group:'urine',abbr:['casts','hyaline casts','granular casts']},
  'urine crystals':{name:'Urine Crystals',min:null,max:null,unit:'',group:'urine',abbr:['crystals']},
  'urine bacteria':{name:'Urine Bacteria',min:null,max:null,unit:'',group:'urine',abbr:['bacteria']},
  'urine culture':{name:'Urine Culture & Sensitivity',min:null,max:null,unit:'',group:'urine',abbr:['urine c/s','urine culture and sensitivity']},
  // Stool / fecal examination
  'stool consistency':{name:'Stool Consistency',min:null,max:null,unit:'',group:'stool',abbr:['consistency','stool physical exam']},
  'stool ova and cyst':{name:'Stool Ova & Cyst',min:null,max:null,unit:'',group:'stool',abbr:['ova and cyst','ova/cyst','o&c','parasites stool']},
  'stool occult blood':{name:'Stool Occult Blood',min:null,max:null,unit:'',group:'stool',abbr:['stool for occult blood','fecal occult blood test']},
  'stool reducing substances':{name:'Stool Reducing Substances',min:null,max:null,unit:'',group:'stool',abbr:['reducing substances']},
  'stool pus cells':{name:'Stool Pus Cells',min:null,max:null,unit:'/hpf',group:'stool',abbr:['pus cells stool']},
  'stool rbc':{name:'Stool RBC',min:null,max:null,unit:'/hpf',group:'stool',abbr:['rbc stool']},
  // Sputum / respiratory microbiology
  'sputum afb smear':{name:'Sputum AFB Smear (Acid-Fast Bacilli)',min:null,max:null,unit:'',group:'sputum',abbr:['afb smear','ziehl neelsen','zn stain','acid fast bacilli']},
  'sputum gram stain':{name:'Sputum Gram Stain',min:null,max:null,unit:'',group:'sputum',abbr:['gram stain']},
  'sputum culture':{name:'Sputum Culture & Sensitivity',min:null,max:null,unit:'',group:'sputum',abbr:['sputum c/s','sputum culture and sensitivity']},
  'throat swab culture':{name:'Throat Swab Culture & Sensitivity',min:null,max:null,unit:'',group:'swab',abbr:['throat swab c/s']},
  'blood culture':{name:'Blood Culture & Sensitivity',min:null,max:null,unit:'',group:'blood',abbr:['blood c/s','blood culture and sensitivity']},
  // Peripheral smear morphology (CBC add-on)
  'rbc morphology':{name:'RBC (Erythrocyte) Morphology',min:null,max:null,unit:'',group:'blood',abbr:['erythrocytes morphology','red cell morphology','erythrocyte morphology']},
  'wbc morphology':{name:'WBC (Leucocyte) Morphology',min:null,max:null,unit:'',group:'blood',abbr:['leucocytes morphology','white cell morphology','leukocytes morphology']},
  'platelets on smear':{name:'Platelets on Smear',min:null,max:null,unit:'',group:'blood',abbr:['platelet on smear','platelets']},
  'parasites on smear':{name:'Parasites on Smear',min:null,max:null,unit:'',group:'blood',abbr:['parasites']},
  // Additional common qualitative screens (autoimmune, TORCH, GI microbiology)
  'anca':{name:'ANCA (Anti-Neutrophil Cytoplasmic Antibody)',min:null,max:null,unit:'',group:'immuno',abbr:['p-anca','c-anca','antineutrophil cytoplasmic antibody']},
  'lupus anticoagulant':{name:'Lupus Anticoagulant Screen',min:null,max:null,unit:'',group:'coag',abbr:['la screen','lupus anticoagulant screen']},
  'h pylori antibody':{name:'H. pylori Antibody/Antigen',min:null,max:null,unit:'',group:'other',abbr:['helicobacter pylori','h. pylori','h pylori antigen','h pylori igg']},
  'toxoplasma igg':{name:'Toxoplasma IgG (TORCH)',min:null,max:null,unit:'',group:'immuno',abbr:['toxoplasma igg antibody']},
  'toxoplasma igm':{name:'Toxoplasma IgM (TORCH)',min:null,max:null,unit:'',group:'immuno',abbr:['toxoplasma igm antibody']},
  'rubella igg':{name:'Rubella IgG (TORCH)',min:null,max:null,unit:'',group:'immuno',abbr:['rubella igg antibody']},
  'rubella igm':{name:'Rubella IgM (TORCH)',min:null,max:null,unit:'',group:'immuno',abbr:['rubella igm antibody']},
  'cmv igg':{name:'CMV IgG (TORCH)',min:null,max:null,unit:'',group:'immuno',abbr:['cytomegalovirus igg']},
  'cmv igm':{name:'CMV IgM (TORCH)',min:null,max:null,unit:'',group:'immuno',abbr:['cytomegalovirus igm']},
  'hsv igg':{name:'HSV IgG (TORCH)',min:null,max:null,unit:'',group:'immuno',abbr:['herpes simplex igg']},
  'hsv igm':{name:'HSV IgM (TORCH)',min:null,max:null,unit:'',group:'immuno',abbr:['herpes simplex igm']},
  'ebv igm':{name:'EBV IgM (Epstein-Barr)',min:null,max:null,unit:'',group:'immuno',abbr:['epstein barr igm','ebv viral capsid antigen igm']},
  'hepatitis a igm':{name:'Hepatitis A IgM',min:null,max:null,unit:'',group:'immuno',abbr:['hav igm','hep a igm']},
  'hepatitis e igm':{name:'Hepatitis E IgM',min:null,max:null,unit:'',group:'immuno',abbr:['hev igm','hep e igm']},

  // ---------- Complete blood count ----------
  'hemoglobin':{name:'Hemoglobin',min:12,max:15,unit:'g/dL',group:'blood',abbr:['hb','hgb']},
  'haemoglobin':{name:'Hemoglobin',min:12,max:15,unit:'g/dL',group:'blood',abbr:[]},
  'erythrocyte':{name:'Erythrocyte (RBC) Count',min:3.8,max:4.8,unit:'mil/cu.mm',group:'blood',abbr:['rbc']},
  'packed cell volume':{name:'Packed Cell Volume',min:36,max:46,unit:'%',group:'blood',abbr:['pcv']},
  'hematocrit':{name:'Hematocrit',min:36,max:46,unit:'%',group:'blood',abbr:['hct']},
  'mean corpuscular volume':{name:'Mean Corpuscular Volume',min:83,max:101,unit:'fL',group:'blood',abbr:['mcv']},
  'mean corpuscular hemoglobin concentration':{name:'Mean Corpuscular Hb Concentration',min:31.5,max:34.5,unit:'g/dL',group:'blood',abbr:['mchc']},
  'mean corpuscular hb concn':{name:'Mean Corpuscular Hb Concentration',min:31.5,max:34.5,unit:'g/dL',group:'blood',abbr:[]},
  'mean corpuscular hemoglobin':{name:'Mean Corpuscular Hemoglobin',min:27,max:32,unit:'pg',group:'blood',abbr:['mch']},
  'red cell distribution width':{name:'Red Cell Distribution Width',min:11.6,max:14.5,unit:'%',group:'blood',abbr:['rdw']},
  'total leucocytes':{name:'Total Leucocytes (WBC) Count',min:4000,max:11000,unit:'cells/cu.mm',group:'blood',abbr:['wbc','tlc']},
  'total leukocytes':{name:'Total Leucocytes (WBC) Count',min:4000,max:11000,unit:'cells/cu.mm',group:'blood',abbr:[]},
  'neutrophils':{name:'Neutrophils',min:40,max:80,unit:'%',group:'blood',abbr:[]},
  'lymphocytes':{name:'Lymphocytes',min:20,max:40,unit:'%',group:'blood',abbr:[]},
  'monocytes':{name:'Monocytes',min:2,max:8,unit:'%',group:'blood',abbr:[]},
  'eosinophils':{name:'Eosinophils',min:0,max:6,unit:'%',group:'blood',abbr:[]},
  'basophils':{name:'Basophils',min:0,max:2,unit:'%',group:'blood',abbr:[]},
  'absolute neutrophil':{name:'Absolute Neutrophil Count',min:2.0,max:7.0,unit:'10^3/uL',group:'blood',abbr:['anc']},
  'absolute lymphocyte':{name:'Absolute Lymphocyte Count',min:1.0,max:3.0,unit:'10^3/uL',group:'blood',abbr:['alc']},
  'absolute monocyte':{name:'Absolute Monocyte Count',min:0.2,max:1.0,unit:'10^3/uL',group:'blood',abbr:['amc']},
  'absolute eosinophil':{name:'Absolute Eosinophil Count',min:0.02,max:0.5,unit:'10^3/uL',group:'blood',abbr:['aec']},
  'absolute basophil':{name:'Absolute Basophil Count',min:0,max:0.1,unit:'10^3/uL',group:'blood',abbr:[]},
  'neutrophil lymphocyte ratio':{name:'Neutrophil/Lymphocyte Ratio',min:null,max:null,unit:'ratio',group:'blood',abbr:['nlr']},
  'platelet':{name:'Platelet Count',min:150,max:410,unit:'10^3/uL',group:'blood',abbr:['plt']},
  'mean platelet volume':{name:'Mean Platelet Volume',min:7.2,max:11.7,unit:'fL',group:'blood',abbr:['mpv']},
  'plateletcrit':{name:'Plateletcrit',min:0.2,max:0.36,unit:'%',group:'blood',abbr:['pct']},
  'pdw':{name:'Platelet Distribution Width',min:9,max:17,unit:'%',group:'blood',abbr:['pdw']},
  'reticulocyte':{name:'Reticulocyte Count',min:0.5,max:2.5,unit:'%',group:'blood',abbr:[]},

  // ---------- Blood sugar ----------
  'fasting blood sugar':{name:'Fasting Blood Sugar',min:70,max:99,unit:'mg/dL',group:'sugar',abbr:['fbs','fbg']},
  'fasting glucose':{name:'Fasting Blood Sugar',min:70,max:99,unit:'mg/dL',group:'sugar',abbr:[]},
  'postprandial':{name:'Post-Prandial Blood Sugar',min:70,max:140,unit:'mg/dL',group:'sugar',abbr:['ppbs']},
  'random blood sugar':{name:'Random Blood Sugar',min:70,max:140,unit:'mg/dL',group:'sugar',abbr:['rbs']},
  'glucose':{name:'Blood Glucose',min:70,max:140,unit:'mg/dL',group:'sugar',abbr:[]},
  'hba1c':{name:'HbA1c (Glycated Hemoglobin)',min:4.0,max:5.6,unit:'%',group:'sugar',abbr:['hba1c','a1c']},
  'glycated hemoglobin':{name:'HbA1c (Glycated Hemoglobin)',min:4.0,max:5.6,unit:'%',group:'sugar',abbr:[]},
  'estimated average glucose':{name:'Estimated Average Glucose',min:70,max:114,unit:'mg/dL',group:'sugar',abbr:['eag']},
  'insulin':{name:'Fasting Insulin',min:2.6,max:24.9,unit:'uIU/mL',group:'sugar',abbr:[]},

  // ---------- Lipid profile ----------
  'total cholesterol':{name:'Total Cholesterol',min:0,max:200,unit:'mg/dL',group:'chol',abbr:[]},
  'cholesterol':{name:'Total Cholesterol',min:0,max:200,unit:'mg/dL',group:'chol',abbr:[]},
  'triglycerides':{name:'Triglycerides',min:0,max:150,unit:'mg/dL',group:'chol',abbr:['tg']},
  'hdl':{name:'HDL Cholesterol',min:40,max:60,unit:'mg/dL',group:'chol',abbr:['hdl']},
  'ldl':{name:'LDL Cholesterol',min:0,max:100,unit:'mg/dL',group:'chol',abbr:['ldl']},
  'vldl':{name:'VLDL Cholesterol',min:0,max:30,unit:'mg/dL',group:'chol',abbr:['vldl']},
  'non-hdl':{name:'Non-HDL Cholesterol',min:0,max:130,unit:'mg/dL',group:'chol',abbr:[]},
  'cholesterol hdl ratio':{name:'Total Cholesterol/HDL Ratio',min:0,max:5.0,unit:'ratio',group:'chol',abbr:[]},
  'ldl hdl ratio':{name:'LDL/HDL Ratio',min:0.5,max:3.0,unit:'ratio',group:'chol',abbr:['ldl/hdl ratio']},
  'hdl ldl ratio':{name:'HDL/LDL Ratio',min:0.3,max:2.0,unit:'ratio',group:'chol',abbr:['hdl/ldl ratio']},

  // ---------- Kidney ----------
  'creatinine':{name:'Serum Creatinine',min:0.6,max:1.3,unit:'mg/dL',group:'kidney',abbr:['creat']},
  'urea':{name:'Blood Urea',min:13,max:43,unit:'mg/dL',group:'kidney',abbr:[]},
  'blood urea nitrogen':{name:'Blood Urea Nitrogen (BUN)',min:7,max:20,unit:'mg/dL',group:'kidney',abbr:['bun']},
  'bun creatinine ratio':{name:'BUN/Creatinine Ratio',min:10,max:20,unit:'ratio',group:'kidney',abbr:['bun/creatinine ratio']},
  'uric acid':{name:'Uric Acid',min:3.5,max:7.2,unit:'mg/dL',group:'kidney',abbr:[]},
  'egfr':{name:'eGFR',min:90,max:200,unit:'mL/min/1.73m2',group:'kidney',abbr:['egfr','gfr']},

  // ---------- Liver ----------
  'bilirubin total':{name:'Bilirubin Total',min:0,max:1.2,unit:'mg/dL',group:'liver',abbr:[]},
  'bilirubin direct':{name:'Bilirubin Direct',min:0,max:0.3,unit:'mg/dL',group:'liver',abbr:[]},
  'bilirubin indirect':{name:'Bilirubin Indirect',min:0.1,max:1.0,unit:'mg/dL',group:'liver',abbr:[]},
  'bilirubin- indirect':{name:'Bilirubin Indirect',min:0.1,max:1.0,unit:'mg/dL',group:'liver',abbr:[]},
  'total bilirubin':{name:'Bilirubin Total',min:0,max:1.2,unit:'mg/dL',group:'liver',abbr:[]},
  'sgpt':{name:'SGPT / ALT',min:0,max:50,unit:'U/L',group:'liver',abbr:['alt','sgpt']},
  'sgot':{name:'SGOT / AST',min:0,max:50,unit:'U/L',group:'liver',abbr:['ast','sgot']},
  'ast alt ratio':{name:'AST/ALT Ratio',min:0,max:1.0,unit:'ratio',group:'liver',abbr:['ast/alt ratio','sgot/sgpt ratio']},
  'alkaline phosphatase':{name:'Alkaline Phosphatase',min:35,max:120,unit:'U/L',group:'liver',abbr:['alp']},
  'gamma gt':{name:'Gamma GT (GGT)',min:0,max:55,unit:'U/L',group:'liver',abbr:['ggt','ggtp']},
  'gamma glutamyl':{name:'Gamma GT (GGT)',min:0,max:55,unit:'U/L',group:'liver',abbr:[]},

  // ---------- Serum proteins ----------
  'total protein':{name:'Total Protein',min:6.4,max:8.3,unit:'g/dL',group:'protein',abbr:[]},
  'albumin, globulin ratio':{name:'Albumin / Globulin Ratio',min:1.1,max:2.2,unit:'ratio',group:'protein',abbr:[]},
  'albumin/globulin':{name:'Albumin / Globulin Ratio',min:1.1,max:2.2,unit:'ratio',group:'protein',abbr:[]},
  'a/g ratio':{name:'Albumin / Globulin Ratio',min:1.1,max:2.2,unit:'ratio',group:'protein',abbr:[]},
  'albumin, serum':{name:'Albumin',min:3.5,max:5.2,unit:'g/dL',group:'protein',abbr:[]},
  'albumin':{name:'Albumin',min:3.5,max:5.2,unit:'g/dL',group:'protein',abbr:['alb']},
  'globulin':{name:'Globulin',min:1.8,max:3.6,unit:'g/dL',group:'protein',abbr:[]},
  'alpha 1 globulin':{name:'Alpha 1 Globulin',min:0.1,max:0.4,unit:'g/dL',group:'protein',abbr:[]},
  'alpha 2 globulin':{name:'Alpha 2 Globulin',min:0.45,max:0.96,unit:'g/dL',group:'protein',abbr:[]},
  'beta 1 globulin':{name:'Beta 1 Globulin',min:0.3,max:0.59,unit:'g/dL',group:'protein',abbr:[]},
  'beta 2 globulin':{name:'Beta 2 Globulin',min:0.2,max:0.53,unit:'g/dL',group:'protein',abbr:[]},
  'gamma globulin':{name:'Gamma Globulin',min:0.71,max:1.54,unit:'g/dL',group:'protein',abbr:[]},

  // ---------- Immunology / light chains ----------
  'kappa- free light chain':{name:'Kappa Free Light Chain',min:3.3,max:19.4,unit:'mg/L',group:'immuno',abbr:[]},
  'kappa free light chain':{name:'Kappa Free Light Chain',min:3.3,max:19.4,unit:'mg/L',group:'immuno',abbr:[]},
  'lambda - free light chain':{name:'Lambda Free Light Chain',min:5.71,max:26.3,unit:'mg/L',group:'immuno',abbr:[]},
  'lambda free light chain':{name:'Lambda Free Light Chain',min:5.71,max:26.3,unit:'mg/L',group:'immuno',abbr:[]},
  'free kappa : lambda ratio':{name:'Free Kappa/Lambda Ratio',min:0.26,max:1.65,unit:'ratio',group:'immuno',abbr:[]},
  'free kappa lambda ratio':{name:'Free Kappa/Lambda Ratio',min:0.26,max:1.65,unit:'ratio',group:'immuno',abbr:[]},

  // ---------- Thyroid ----------
  'tsh':{name:'TSH',min:0.4,max:4.0,unit:'uIU/mL',group:'thyroid',abbr:['tsh']},
  'thyroid stimulating hormone':{name:'TSH',min:0.4,max:4.0,unit:'uIU/mL',group:'thyroid',abbr:[]},
  'total t3':{name:'Total T3',min:80,max:200,unit:'ng/dL',group:'thyroid',abbr:['t3']},
  'total t4':{name:'Total T4',min:5.1,max:14.1,unit:'ug/dL',group:'thyroid',abbr:['t4']},
  'free t3':{name:'Free T3 (FT3)',min:2.3,max:4.2,unit:'pg/mL',group:'thyroid',abbr:['ft3']},
  'free t4':{name:'Free T4 (FT4)',min:0.8,max:1.8,unit:'ng/dL',group:'thyroid',abbr:['ft4']},
  'anti tpo':{name:'Anti-TPO Antibody',min:0,max:34,unit:'IU/mL',group:'thyroid',abbr:['tpo']},

  // ---------- Electrolytes & minerals ----------
  'sodium':{name:'Sodium',min:136,max:145,unit:'mmol/L',group:'electro',abbr:['na']},
  'potassium':{name:'Potassium',min:3.5,max:5.1,unit:'mmol/L',group:'electro',abbr:[]},
  'chloride':{name:'Chloride',min:98,max:107,unit:'mmol/L',group:'electro',abbr:[]},
  'bicarbonate':{name:'Bicarbonate',min:22,max:29,unit:'mmol/L',group:'electro',abbr:['hco3']},
  'calcium':{name:'Calcium',min:8.6,max:10.3,unit:'mg/dL',group:'electro',abbr:[]},
  'phosphorus':{name:'Phosphorus',min:2.5,max:4.5,unit:'mg/dL',group:'electro',abbr:[]},
  'magnesium':{name:'Magnesium',min:1.7,max:2.2,unit:'mg/dL',group:'electro',abbr:['mg']},

  // ---------- Vitamins ----------
  'vitamin d':{name:'Vitamin D (25-OH)',min:30,max:100,unit:'ng/mL',group:'vitamin',abbr:[]},
  '25-hydroxy':{name:'Vitamin D (25-OH)',min:30,max:100,unit:'ng/mL',group:'vitamin',abbr:[]},
  'vitamin b12':{name:'Vitamin B12',min:211,max:911,unit:'pg/mL',group:'vitamin',abbr:['b12']},
  'folate':{name:'Folate (Folic Acid)',min:3.1,max:230,unit:'ng/mL',group:'vitamin',abbr:[]},
  'folic acid':{name:'Folate (Folic Acid)',min:3.1,max:20,unit:'ng/mL',group:'vitamin',abbr:[]},

  // ---------- Iron studies ----------
  'serum iron':{name:'Serum Iron',min:65,max:175,unit:'ug/dL',group:'iron',abbr:[]},
  'ferritin':{name:'Ferritin',min:22,max:322,unit:'ng/mL',group:'iron',abbr:[]},
  'transferrin':{name:'Transferrin Saturation',min:20,max:50,unit:'%',group:'iron',abbr:[]},
  'tibc':{name:'Total Iron Binding Capacity',min:250,max:450,unit:'ug/dL',group:'iron',abbr:['tibc']},
  'uibc':{name:'Unsaturated Iron Binding Capacity',min:111,max:343,unit:'ug/dL',group:'iron',abbr:['uibc']},

  // ---------- Cardiac / inflammation ----------
  'troponin':{name:'Troponin I',min:0,max:0.04,unit:'ng/mL',group:'cardiac',abbr:[]},
  'ck-mb':{name:'CK-MB',min:0,max:24,unit:'U/L',group:'cardiac',abbr:['ckmb']},
  'creatine kinase':{name:'Creatine Kinase (CPK)',min:30,max:200,unit:'U/L',group:'cardiac',abbr:['cpk']},
  'bnp':{name:'BNP',min:0,max:100,unit:'pg/mL',group:'cardiac',abbr:['bnp']},
  'homocysteine':{name:'Homocysteine',min:5,max:15,unit:'umol/L',group:'cardiac',abbr:[]},
  'c-reactive protein':{name:'C-Reactive Protein (CRP)',min:0,max:5,unit:'mg/L',group:'inflam',abbr:['crp']},
  'hs-crp':{name:'hs-CRP',min:0,max:3,unit:'mg/L',group:'inflam',abbr:['hscrp']},
  'esr':{name:'ESR (Sedimentation Rate)',min:0,max:20,unit:'mm/hr',group:'inflam',abbr:['esr']},
  'procalcitonin':{name:'Procalcitonin',min:0,max:0.5,unit:'ng/mL',group:'inflam',abbr:[]},

  // ---------- Coagulation ----------
  'prothrombin time':{name:'Prothrombin Time (PT)',min:11,max:13.5,unit:'sec',group:'coag',abbr:['pt']},
  'pt(inr)':{name:'INR',min:0.8,max:1.2,unit:'ratio',group:'coag',abbr:[]},
  'inr':{name:'INR',min:0.8,max:1.2,unit:'ratio',group:'coag',abbr:['inr']},
  'aptt':{name:'APTT',min:25,max:35,unit:'sec',group:'coag',abbr:['aptt','ptt']},
  'd-dimer':{name:'D-Dimer',min:0,max:0.5,unit:'ug/mL FEU',group:'coag',abbr:[]},
  'fibrinogen':{name:'Fibrinogen',min:200,max:400,unit:'mg/dL',group:'coag',abbr:[]},

  // ---------- Eye (ophthalmology) ----------
  'intraocular pressure':{name:'Intraocular Pressure',min:10,max:21,unit:'mmHg',group:'eye',abbr:['iop']},
  'iop right':{name:'Intraocular Pressure (Right)',min:10,max:21,unit:'mmHg',group:'eye',abbr:[]},
  'iop left':{name:'Intraocular Pressure (Left)',min:10,max:21,unit:'mmHg',group:'eye',abbr:[]},
  'central corneal thickness':{name:'Central Corneal Thickness',min:490,max:590,unit:'µm',group:'eye',abbr:['cct']},

  // ---------- Cardiac (echo / ECG) ----------
  'ejection fraction':{name:'Ejection Fraction (LVEF)',min:55,max:70,unit:'%',group:'cardiac',abbr:['ef','lvef']},
  'heart rate':{name:'Heart Rate',min:60,max:100,unit:'bpm',group:'cardiac',abbr:['hr']},
  'pulse':{name:'Heart Rate',min:60,max:100,unit:'bpm',group:'cardiac',abbr:[]},
  'qtc':{name:'QTc Interval',min:350,max:450,unit:'ms',group:'cardiac',abbr:['qtc']},
  'systolic':{name:'Blood Pressure (Systolic)',min:90,max:120,unit:'mmHg',group:'cardiac',abbr:[]},
  'diastolic':{name:'Blood Pressure (Diastolic)',min:60,max:80,unit:'mmHg',group:'cardiac',abbr:[]},

  // ---------- Mental health screening scores (higher = more symptoms) ----------
  'phq-9':{name:'PHQ-9 (Depression Score)',min:0,max:4,unit:'score',group:'mental',abbr:['phq9','phq']},
  'gad-7':{name:'GAD-7 (Anxiety Score)',min:0,max:4,unit:'score',group:'mental',abbr:['gad7','gad']},

  // ---------- Hormones ----------
  'estradiol':{name:'Estradiol (E2)',min:114,max:332,unit:'pmol/L',group:'hormone',abbr:['e2'],phased:true},
  'fsh':{name:'FSH (Follicle Stimulating Hormone)',min:3.5,max:12.5,unit:'mIU/mL',group:'hormone',abbr:['fsh'],phased:true},
  'follicle stimulating hormone':{name:'FSH (Follicle Stimulating Hormone)',min:3.5,max:12.5,unit:'mIU/mL',group:'hormone',abbr:[],phased:true},
  'lh':{name:'LH (Luteinising Hormone)',min:2.4,max:12.6,unit:'mIU/mL',group:'hormone',abbr:['lh'],phased:true},
  'luteinising hormone':{name:'LH (Luteinising Hormone)',min:2.4,max:12.6,unit:'mIU/mL',group:'hormone',abbr:[],phased:true},
  'luteinizing hormone':{name:'LH (Luteinising Hormone)',min:2.4,max:12.6,unit:'mIU/mL',group:'hormone',abbr:[],phased:true},
  'progesterone':{name:'Progesterone',min:0.6,max:4.7,unit:'nmol/L',group:'hormone',abbr:[],phased:true},
  'anti mullerian':{name:'Anti-Mullerian Hormone (AMH)',min:1.0,max:6.8,unit:'ng/mL',group:'hormone',abbr:['amh']},
  'oestradiol':{name:'Estradiol (E2)',min:114,max:332,unit:'pmol/L',group:'hormone',abbr:[],phased:true},
  'testosterone':{name:'Total Testosterone',min:240,max:950,unit:'ng/dL',group:'hormone',abbr:[]},
  'prolactin':{name:'Prolactin',min:4,max:23,unit:'ng/mL',group:'hormone',abbr:[]},
  'cortisol':{name:'Cortisol (Morning)',min:5,max:23,unit:'ug/dL',group:'hormone',abbr:[]},
  'psa':{name:'PSA (Total)',min:0,max:4,unit:'ng/mL',group:'hormone',abbr:['psa']},

  // ---------- Urine ----------
  'urine - protein':{name:'Urine Protein (spot)',min:0,max:14,unit:'mg/dL',group:'urine',abbr:[]},
  'urine - creatinine':{name:'Urine Creatinine (spot)',min:20,max:320,unit:'mg/dL',group:'urine',abbr:[]},
  'protein/creatinine ratio':{name:'Urine Protein/Creatinine Ratio',min:0,max:0.2,unit:'ratio',group:'urine',abbr:['pcr']},
  'specific gravity':{name:'Urine Specific Gravity',min:1.005,max:1.03,unit:'',group:'urine',abbr:[]},
  'microalbumin':{name:'Urine Microalbumin',min:0,max:30,unit:'mg/L',group:'urine',abbr:[]},

  // ================= Added from NBME + ABIM reference tables (Jan 2026) =================
  // ---------- Pancreatic / GI enzymes ----------
  'amylase':{name:'Amylase',min:25,max:125,unit:'U/L',group:'liver',abbr:[]},
  'lipase':{name:'Lipase',min:10,max:140,unit:'U/L',group:'liver',abbr:[]},
  'ldh':{name:'Lactate Dehydrogenase (LDH)',min:80,max:225,unit:'U/L',group:'liver',abbr:['ldh']},
  'lactate dehydrogenase':{name:'Lactate Dehydrogenase (LDH)',min:80,max:225,unit:'U/L',group:'liver',abbr:[]},
  'ammonia':{name:'Ammonia',min:40,max:70,unit:'ug/dL',group:'liver',abbr:[]},
  'prealbumin':{name:'Prealbumin',min:16,max:30,unit:'mg/dL',group:'liver',abbr:[]},
  'alpha 1 antitrypsin':{name:'Alpha-1 Antitrypsin (AAT)',min:150,max:350,unit:'mg/dL',group:'liver',abbr:['aat']},
  'ceruloplasmin':{name:'Ceruloplasmin',min:25,max:43,unit:'mg/dL',group:'liver',abbr:[]},
  'haptoglobin':{name:'Haptoglobin',min:83,max:267,unit:'mg/dL',group:'blood',abbr:[]},
  'fecal fat':{name:'Faecal Fat',min:0,max:7,unit:'g/24h',group:'other',abbr:[]},

  // ---------- Electrolytes / metabolic ----------
  'anion gap':{name:'Anion Gap',min:7,max:13,unit:'mEq/L',group:'kidney',abbr:[]},
  'osmolality':{name:'Serum Osmolality',min:275,max:295,unit:'mOsm/kg',group:'kidney',abbr:[]},
  'lactate':{name:'Lactate',min:0.7,max:2.1,unit:'mmol/L',group:'metabolic',abbr:[]},
  'lactic acid':{name:'Lactic Acid',min:0.7,max:2.1,unit:'mmol/L',group:'metabolic',abbr:[]},
  'beta hydroxybutyrate':{name:'Beta-Hydroxybutyrate',min:0,max:0.4,unit:'mmol/L',group:'metabolic',abbr:[]},
  'pyruvic acid':{name:'Pyruvic Acid',min:0.08,max:0.16,unit:'mmol/L',group:'metabolic',abbr:[]},
  'methylmalonic acid':{name:'Methylmalonic Acid',min:0,max:0.40,unit:'umol/L',group:'metabolic',abbr:['mma']},
  'calcium ionized':{name:'Ionised Calcium',min:1.16,max:1.31,unit:'mmol/L',group:'kidney',abbr:[]},

  // ---------- Blood gases (arterial, room air) ----------
  'ph':{name:'Arterial pH',min:7.35,max:7.45,unit:'',group:'gases',abbr:[]},
  'paco2':{name:'PaCO2 (Arterial)',min:33,max:45,unit:'mmHg',group:'gases',abbr:['pco2']},
  'pao2':{name:'PaO2 (Arterial)',min:75,max:105,unit:'mmHg',group:'gases',abbr:['po2']},
  'oxygen saturation':{name:'Oxygen Saturation',min:95,max:100,unit:'%',group:'gases',abbr:['spo2','sao2']},
  'methemoglobin':{name:'Methaemoglobin',min:0.5,max:3.0,unit:'%',group:'gases',abbr:[]},
  'carboxyhemoglobin':{name:'Carboxyhaemoglobin',min:0,max:5,unit:'%',group:'gases',abbr:[]},

  // ---------- Cardiac ----------
  'nt-probnp':{name:'NT-proBNP',min:0,max:300,unit:'pg/mL',group:'cardiac',abbr:['ntprobnp','nt pro bnp']},
  'troponin t':{name:'Troponin T (cardiac)',min:0,max:0.01,unit:'ng/mL',group:'cardiac',abbr:[]},
  'myoglobin':{name:'Myoglobin',min:0,max:100,unit:'ug/L',group:'cardiac',abbr:[]},

  // ---------- Lipids (extended) ----------
  'lipoprotein a':{name:'Lipoprotein(a)',min:0,max:30,unit:'mg/dL',group:'lipid',abbr:['lp(a)','lpa']},
  'apolipoprotein b':{name:'Apolipoprotein B',min:0,max:90,unit:'mg/dL',group:'lipid',abbr:['apob']},
  'phospholipids':{name:'Phospholipids (total)',min:200,max:300,unit:'mg/dL',group:'lipid',abbr:[]},

  // ---------- Iron / haematinics ----------
  'transferrin saturation':{name:'Transferrin Saturation',min:20,max:50,unit:'%',group:'blood',abbr:['tsat']},
  'red cell folate':{name:'Red Cell Folate',min:150,max:450,unit:'ng/mL',group:'vitamin',abbr:[]},

  // ---------- Vitamins / trace elements ----------
  'vitamin a':{name:'Vitamin A (Retinol)',min:32.5,max:78.0,unit:'ug/dL',group:'vitamin',abbr:[]},
  'vitamin e':{name:'Vitamin E',min:5.5,max:17.0,unit:'mg/L',group:'vitamin',abbr:[]},
  'vitamin c':{name:'Vitamin C (Ascorbic Acid)',min:0.4,max:1.5,unit:'mg/dL',group:'vitamin',abbr:[]},
  'ascorbic acid':{name:'Vitamin C (Ascorbic Acid)',min:0.4,max:1.5,unit:'mg/dL',group:'vitamin',abbr:[]},
  '1,25 dihydroxyvitamin d':{name:'1,25-Dihydroxyvitamin D',min:15,max:60,unit:'pg/mL',group:'vitamin',abbr:[]},
  'zinc':{name:'Zinc',min:75,max:140,unit:'ug/dL',group:'vitamin',abbr:[]},
  'copper':{name:'Copper',min:100,max:200,unit:'ug/dL',group:'vitamin',abbr:[]},
  'lead':{name:'Lead (blood)',min:0,max:5.0,unit:'ug/dL',group:'other',abbr:[]},

  // ---------- Endocrine ----------
  'acth':{name:'ACTH',min:10,max:60,unit:'pg/mL',group:'hormone',abbr:['acth']},
  'pth':{name:'Parathyroid Hormone (intact)',min:10,max:65,unit:'pg/mL',group:'hormone',abbr:['pth']},
  'parathyroid hormone':{name:'Parathyroid Hormone (intact)',min:10,max:65,unit:'pg/mL',group:'hormone',abbr:[]},
  'c peptide':{name:'C-Peptide',min:0.8,max:3.1,unit:'ng/mL',group:'hormone',abbr:[]},
  'proinsulin':{name:'Proinsulin',min:3,max:20,unit:'pmol/L',group:'hormone',abbr:[]},
  'growth hormone':{name:'Growth Hormone (at rest)',min:0,max:5,unit:'ng/mL',group:'hormone',abbr:['gh']},
  'igf-1':{name:'IGF-1 (Somatomedin-C)',min:71,max:290,unit:'ng/mL',group:'hormone',abbr:['igf1','somatomedin c']},
  'thyroglobulin':{name:'Thyroglobulin',min:0,max:20,unit:'ng/mL',group:'thyroid',abbr:[]},
  'reverse t3':{name:'Reverse T3',min:20,max:40,unit:'ng/dL',group:'thyroid',abbr:['rt3']},
  't3 resin uptake':{name:'T3 Resin Uptake',min:25,max:35,unit:'%',group:'thyroid',abbr:[]},
  'thyroxine binding globulin':{name:'Thyroxine-Binding Globulin',min:12,max:27,unit:'ug/mL',group:'thyroid',abbr:['tbg']},
  'anti thyroglobulin':{name:'Anti-Thyroglobulin Antibody',min:0,max:20,unit:'U/mL',group:'thyroid',abbr:[]},
  'aldosterone':{name:'Aldosterone (supine)',min:0,max:10,unit:'ng/dL',group:'hormone',abbr:[]},
  '17 hydroxyprogesterone':{name:'17-Hydroxyprogesterone',min:0,max:220,unit:'ng/dL',group:'hormone',abbr:['17-ohp'],phased:true},
  'erythropoietin':{name:'Erythropoietin',min:4,max:26,unit:'mU/mL',group:'hormone',abbr:['epo']},
  'gastrin':{name:'Gastrin',min:0,max:100,unit:'pg/mL',group:'hormone',abbr:[]},
  'chromogranin a':{name:'Chromogranin A',min:0,max:93,unit:'ng/mL',group:'tumour',abbr:[]},

  // ---------- Tumour markers ----------
  'alpha fetoprotein':{name:'Alpha-Fetoprotein (AFP)',min:0,max:10,unit:'ng/mL',group:'tumour',abbr:['afp']},
  'cea':{name:'Carcinoembryonic Antigen (CEA)',min:0,max:2.5,unit:'ng/mL',group:'tumour',abbr:['cea']},
  'ca 19-9':{name:'CA 19-9',min:0,max:37,unit:'U/mL',group:'tumour',abbr:['ca19-9']},
  'ca 125':{name:'CA 125',min:0,max:35,unit:'U/mL',group:'tumour',abbr:['ca125']},
  'ca 27-29':{name:'CA 27-29',min:0,max:38,unit:'U/mL',group:'tumour',abbr:[]},
  'beta 2 microglobulin':{name:'Beta-2 Microglobulin',min:0.54,max:2.75,unit:'mg/L',group:'tumour',abbr:[]},

  // ---------- Immunology / immunoglobulins ----------
  'iga':{name:'IgA',min:90,max:325,unit:'mg/dL',group:'immune',abbr:['iga']},
  'igg':{name:'IgG',min:800,max:1500,unit:'mg/dL',group:'immune',abbr:['igg']},
  'igm':{name:'IgM',min:45,max:150,unit:'mg/dL',group:'immune',abbr:['igm']},
  'ige':{name:'IgE',min:0,max:380,unit:'IU/mL',group:'immune',abbr:['ige']},
  'complement c3':{name:'Complement C3',min:100,max:233,unit:'mg/dL',group:'immune',abbr:['c3']},
  'complement c4':{name:'Complement C4',min:14,max:48,unit:'mg/dL',group:'immune',abbr:['c4']},
  'ch50':{name:'CH50 (Total Complement)',min:110,max:190,unit:'units/mL',group:'immune',abbr:[]},
  'rheumatoid factor':{name:'Rheumatoid Factor',min:0,max:24,unit:'IU/mL',group:'immune',abbr:['rf']},
  'anti ccp':{name:'Anti-CCP Antibody',min:0,max:20,unit:'units',group:'immune',abbr:['ccp']},
  'anti dsdna':{name:'Anti-dsDNA Antibody',min:0,max:7,unit:'IU/mL',group:'immune',abbr:['dsdna']},
  'aso titer':{name:'Antistreptolysin O (ASO)',min:0,max:200,unit:'Todd units',group:'immune',abbr:['aso']},
  'ace':{name:'Angiotensin-Converting Enzyme (ACE)',min:8,max:53,unit:'U/L',group:'immune',abbr:['ace']},
  'tryptase':{name:'Tryptase',min:0,max:11.5,unit:'ng/mL',group:'immune',abbr:[]},

  // ---------- Coagulation (extended) ----------
  'thrombin time':{name:'Thrombin Time',min:17,max:23,unit:'seconds',group:'coag',abbr:['tt']},
  'antithrombin':{name:'Antithrombin Activity',min:80,max:120,unit:'%',group:'coag',abbr:['at3']},
  'protein c':{name:'Protein C Activity',min:65,max:150,unit:'%',group:'coag',abbr:[]},
  'protein s':{name:'Protein S Activity',min:57,max:131,unit:'%',group:'coag',abbr:[]},
  'factor viii':{name:'Factor VIII',min:50,max:150,unit:'%',group:'coag',abbr:[]},
  'von willebrand factor':{name:'von Willebrand Factor Activity',min:50,max:150,unit:'%',group:'coag',abbr:['vwf']},
  'bleeding time':{name:'Bleeding Time',min:0,max:8,unit:'minutes',group:'coag',abbr:[]},
  'fibrin degradation products':{name:'Fibrin Degradation Products',min:0,max:10,unit:'ug/mL',group:'coag',abbr:['fdp']},

  // ---------- Haematology (extended) ----------
  'absolute reticulocyte':{name:'Absolute Reticulocyte Count',min:25000,max:100000,unit:'/uL',group:'cbc',abbr:[]},
  'immature platelet fraction':{name:'Immature Platelet Fraction',min:1,max:5,unit:'%',group:'cbc',abbr:['ipf']},
  'g6pd':{name:'G6PD',min:5,max:15,unit:'units/g Hb',group:'cbc',abbr:['g6pd']},
  'cd4 count':{name:'CD4 T-Lymphocyte Count',min:530,max:1570,unit:'/uL',group:'immune',abbr:['cd4']},
  'cd8 count':{name:'CD8 T-Lymphocyte Count',min:430,max:1060,unit:'/uL',group:'immune',abbr:['cd8']},
  'cd3 count':{name:'CD3 T-Lymphocyte Count',min:900,max:3245,unit:'/uL',group:'immune',abbr:['cd3']},
  'hb a2':{name:'Haemoglobin A2',min:1.5,max:3.5,unit:'%',group:'cbc',abbr:[]},
  'hb f':{name:'Haemoglobin F',min:0,max:1,unit:'%',group:'cbc',abbr:[]},
  'plasma hemoglobin':{name:'Plasma Haemoglobin',min:0,max:5.0,unit:'mg/dL',group:'cbc',abbr:[]},
  'serum viscosity':{name:'Serum Viscosity',min:1.4,max:1.8,unit:'cp',group:'blood',abbr:[]},

  // ---------- Cerebrospinal fluid ----------
  'csf glucose':{name:'CSF Glucose',min:50,max:75,unit:'mg/dL',group:'csf',abbr:[]},
  'csf protein':{name:'CSF Total Protein',min:15,max:45,unit:'mg/dL',group:'csf',abbr:[]},
  'csf cell count':{name:'CSF Leukocyte Count',min:0,max:5,unit:'cells/uL',group:'csf',abbr:[]},
  'csf chloride':{name:'CSF Chloride',min:120,max:130,unit:'mEq/L',group:'csf',abbr:[]},
  'csf pressure':{name:'CSF Opening Pressure',min:70,max:180,unit:'mm H2O',group:'csf',abbr:[]},

  // ---------- Urine (extended) ----------
  'urine osmolality':{name:'Urine Osmolality',min:38,max:1400,unit:'mOsm/kg',group:'urine',abbr:[]},
  'urine ph':{name:'Urine pH',min:4.5,max:8.0,unit:'',group:'urine',abbr:[]},
  'urine oxalate':{name:'Urine Oxalate',min:0,max:40,unit:'mg/24h',group:'urine',abbr:[]},
  'urine citrate':{name:'Urine Citrate',min:250,max:1000,unit:'mg/24h',group:'urine',abbr:[]},
  'urine uric acid':{name:'Urine Uric Acid',min:250,max:750,unit:'mg/24h',group:'urine',abbr:[]},
  'urine urea nitrogen':{name:'Urine Urea Nitrogen',min:12,max:20,unit:'g/24h',group:'urine',abbr:[]},
  'albumin creatinine ratio':{name:'Urine Albumin-to-Creatinine Ratio',min:0,max:30,unit:'mg/g',group:'urine',abbr:['acr']},

  // ---------- Other ----------
  'bmi':{name:'Body Mass Index (BMI)',min:19,max:25,unit:'kg/m2',group:'other',abbr:['bmi']},
  'procalcitonin extended':{name:'Procalcitonin',min:0,max:0.10,unit:'ng/mL',group:'other',abbr:[]},
  'homocysteine extended':{name:'Homocysteine',min:5,max:15,unit:'umol/L',group:'metabolic',abbr:[]}
};


/* ================= SEX- AND AGE-SPECIFIC REFERENCE RANGES =================
   Reference intervals are not universal. Haemoglobin, haematocrit, creatinine,
   uric acid, ferritin and others differ substantially between men and women, and
   almost everything differs in children. Applying one adult-female range to a man
   (or to a 7-year-old) produces confidently WRONG high/low flags.

   Precedence: the range printed on the report itself > these overrides > the
   generic library default. We only ever override when we know the person's
   sex/age from their profile.
   Sources are standard adult clinical reference intervals; labs vary, which is
   exactly why the report's own printed range always wins.                        */
const RANGE_OVERRIDES={
  // Sex- and age-specific reference ranges.
  //   male/female : adult ranges
  //   age         : PAEDIATRIC bands (age <= max), used ahead of sex
  //   ageAdult    : ADULT age bands (age <= max), for markers that genuinely
  //                 drift with age in adulthood (e.g. IGF-1)
  //   maleAge/femaleAge : sex-specific paediatric or life-stage bands
  // Sources: NBME Laboratory Values; ABIM Laboratory Test Reference Ranges (Jan 2026).
  hemoglobin:{ male:{min:13.5,max:17.5}, female:{min:12.0,max:16.0},
               age:[{max:0.08,min:14.0,maxV:24.0},{max:1,min:9.5,maxV:13.5},{max:6,min:11.0,maxV:14.0},{max:12,min:11.5,maxV:15.5},{max:18,min:12.0,maxV:16.0}] },
  haemoglobin:{ male:{min:13.5,max:17.5}, female:{min:12.0,max:16.0},
               age:[{max:0.08,min:14.0,maxV:24.0},{max:1,min:9.5,maxV:13.5},{max:6,min:11.0,maxV:14.0},{max:12,min:11.5,maxV:15.5},{max:18,min:12.0,maxV:16.0}] },
  hematocrit:{ male:{min:41,max:53}, female:{min:36,max:46} },
  'packed cell volume':{ male:{min:41,max:53}, female:{min:36,max:46} },
  erythrocyte:{ male:{min:4.3,max:5.9}, female:{min:3.5,max:5.5} },
  creatinine:{ male:{min:0.70,max:1.30}, female:{min:0.50,max:1.10},
               age:[{max:12,min:0.30,maxV:0.70},{max:18,min:0.50,maxV:1.00}] },
  'uric acid':{ male:{min:3.4,max:7.0}, female:{min:2.4,max:6.0} },
  ferritin:{ male:{min:24,max:336}, female:{min:24,max:307} },
  'serum iron':{ male:{min:65,max:175}, female:{min:50,max:170} },
  testosterone:{ male:{min:291,max:1100}, female:{min:18,max:54} },
  psa:{ female:{min:0,max:0} },                       // not applicable
  'creatine kinase':{ male:{min:55,max:170}, female:{min:30,max:135} },
  esr:{ male:{min:0,max:15}, female:{min:0,max:20} },
  'gamma gt':{ male:{min:9,max:50}, female:{min:8,max:40} },
  'gamma glutamyl':{ male:{min:9,max:50}, female:{min:8,max:40} },
  hdl:{ male:{min:40,max:200}, female:{min:50,max:200} },
  'total leucocytes':{ age:[{max:1,min:6000,maxV:17500},{max:12,min:5000,maxV:15500},{max:18,min:4500,maxV:13500}] },
  'total leukocytes':{ age:[{max:1,min:6000,maxV:17500},{max:12,min:5000,maxV:15500},{max:18,min:4500,maxV:13500}] },
  'alkaline phosphatase':{ age:[{max:12,min:100,maxV:400},{max:18,min:50,maxV:250}] }, // bone growth

  // ---- Added from NBME + ABIM (Jan 2026) ----
  'creatinine clearance':{ male:{min:97,max:137}, female:{min:88,max:128} },
  'apolipoprotein a1':{ male:{min:120,max:250}, female:{min:140,max:250} },
  calcitonin:{ male:{min:0,max:10}, female:{min:0,max:5} },
  osteocalcin:{ male:{min:11.3,max:35.4}, female:{min:7.2,max:27.9} },
  'dhea sulfate':{ male:{min:89,max:457}, female:{min:44,max:332} },
  androstenedione:{ male:{min:40,max:150}, female:{min:30,max:200} },
  shbg:{ male:{min:10,max:57}, female:{min:18,max:144} },
  'troponin i high sensitivity':{ male:{min:0,max:20}, female:{min:0,max:15} },
  'troponin t high sensitivity':{ male:{min:0,max:15}, female:{min:0,max:10} },
  'urine calcium':{ male:{min:0,max:300}, female:{min:0,max:250} },
  'n telopeptide':{ male:{min:7,max:68}, female:{min:11,max:48} },
  'bone specific alkaline phosphatase':{ male:{min:6.5,max:20.1}, female:{min:4.5,max:22.4} },
  '1,5 anhydroglucitol':{ male:{min:10.7,max:32}, female:{min:6.8,max:29.3} },
  '17 hydroxycorticosteroids':{ male:{min:3.0,max:10.0}, female:{min:2.0,max:8.0} },
  '17 ketosteroids':{ male:{min:8,max:20}, female:{min:6,max:15} },
  'urine creatine':{ male:{min:0,max:40}, female:{min:0,max:100} },
  prolactin:{ male:{min:0,max:17}, female:{min:0,max:25} },

  // IGF-1 falls steadily with age through adulthood -- an adult-band marker,
  // not a paediatric one, so it uses ageAdult rather than age.
  'igf-1':{ ageAdult:[{max:24,min:182,maxV:780},{max:39,min:114,maxV:492},{max:54,min:90,maxV:360},{max:200,min:71,maxV:290}] },

  // Paediatric-specific vitamin ranges (ages 1-2 differ markedly from adult).
  'vitamin a':{ age:[{max:2,min:20,maxV:43}] },
  'vitamin e':{ age:[{max:2,min:2.9,maxV:16.6}] }
};
// Returns {min,max,note} for a marker given the profile, or null.
function rangeForProfile(key,sex,age){
  const o=RANGE_OVERRIDES[key]; if(!o)return null;
  // Age bands take precedence for children — paediatric physiology differs far more
  // than sex does, and a child judged against adult ranges is badly misflagged.
  if(age!=null && age<18 && Array.isArray(o.age)){
    const band=o.age.find(b=>age<=b.max);
    if(band)return {min:band.min,max:band.maxV,note:`paediatric range (age ${age})`};
  }
  if(age!=null && age<18 && !Array.isArray(o.age) && !Array.isArray(o.ageAdult))return null; // unknown paediatric -> don't guess
  // A few markers (e.g. IGF-1) drift enough across ADULT life that a single
  // adult range would misflag most people; those carry explicit adult bands.
  if(age!=null && Array.isArray(o.ageAdult)){
    const band=o.ageAdult.find(b=>age<=b.max);
    if(band)return {min:band.min,max:band.maxV,note:`age-specific range (age ${age})`};
  }
  if(sex==='male'&&o.male)return {min:o.male.min,max:o.male.max,note:'male adult range'};
  if(sex==='female'&&o.female)return {min:o.female.min,max:o.female.max,note:'female adult range'};
  return null;
}

// Aliases -> canonical key (so long/short/spelled-out names collapse to one marker)
const ALIASES = {
  // ---- Aliases for markers added from NBME + ABIM tables ----
  'lactate dehydrogenase, serum':'ldh','ldh serum':'ldh','l d h':'ldh',
  'serum amylase':'amylase','amylase, serum':'amylase',
  'serum lipase':'lipase','lipase, serum':'lipase',
  'serum ammonia':'ammonia','ammonia, plasma':'ammonia',
  'alpha-1 antitrypsin':'alpha 1 antitrypsin','alpha1 antitrypsin':'alpha 1 antitrypsin','a1at':'alpha 1 antitrypsin',
  'serum osmolality':'osmolality','osmolality, serum':'osmolality',
  'osmolality, urine':'urine osmolality',
  'ionized calcium':'calcium ionized','ionised calcium':'calcium ionized','calcium, ionized':'calcium ionized',
  'arterial ph':'ph','blood ph':'ph',
  'pco2':'paco2','partial pressure co2':'paco2','carbon dioxide partial pressure':'paco2',
  'po2':'pao2','partial pressure o2':'pao2','oxygen partial pressure':'pao2',
  'o2 saturation':'oxygen saturation','sao2':'oxygen saturation','spo2':'oxygen saturation','oxygen sat':'oxygen saturation',
  'n terminal pro bnp':'nt-probnp','nt pro bnp':'nt-probnp','nt-pro-bnp':'nt-probnp','pro bnp':'nt-probnp',
  'troponin t cardiac':'troponin t','cardiac troponin t':'troponin t',
  'high sensitivity troponin i':'troponin i high sensitivity','hs troponin i':'troponin i high sensitivity','hs-troponin i':'troponin i high sensitivity',
  'high sensitivity troponin t':'troponin t high sensitivity','hs troponin t':'troponin t high sensitivity','hs-troponin t':'troponin t high sensitivity',
  'lipoprotein (a)':'lipoprotein a','lp (a)':'lipoprotein a','lp-a':'lipoprotein a',
  'apo b':'apolipoprotein b','apolipoprotein-b':'apolipoprotein b',
  'apo a1':'apolipoprotein a1','apolipoprotein a-1':'apolipoprotein a1','apolipoprotein a 1':'apolipoprotein a1','apo a-1':'apolipoprotein a1',
  'iron saturation':'transferrin saturation','% transferrin saturation':'transferrin saturation','tsat':'transferrin saturation',
  'folate red cell':'red cell folate','rbc folate':'red cell folate',
  'retinol':'vitamin a','alpha tocopherol':'vitamin e',
  '1,25 dihydroxy vitamin d':'1,25 dihydroxyvitamin d','1,25-dihydroxyvitamin d':'1,25 dihydroxyvitamin d','calcitriol':'1,25 dihydroxyvitamin d',
  'serum zinc':'zinc','serum copper':'copper','blood lead':'lead','lead level':'lead',
  'adrenocorticotropic hormone':'acth','corticotropin':'acth',
  'intact pth':'pth','parathormone':'pth','parathyroid hormone intact':'pth',
  'c-peptide':'c peptide','connecting peptide':'c peptide',
  'growth hormone, serum':'growth hormone','hgh':'growth hormone','somatotropin':'growth hormone',
  'insulin like growth factor 1':'igf-1','insulin-like growth factor 1':'igf-1','igf 1':'igf-1','somatomedin-c':'igf-1',
  'anti thyroglobulin antibody':'anti thyroglobulin','antithyroglobulin':'anti thyroglobulin','tg antibody':'anti thyroglobulin',
  'reverse triiodothyronine':'reverse t3','rt3':'reverse t3',
  't3 uptake':'t3 resin uptake','resin t3 uptake':'t3 resin uptake',
  'tbg':'thyroxine binding globulin',
  '17-hydroxyprogesterone':'17 hydroxyprogesterone','17 ohp':'17 hydroxyprogesterone','17-ohp':'17 hydroxyprogesterone',
  '17-hydroxycorticosteroids':'17 hydroxycorticosteroids','17-ketosteroids':'17 ketosteroids',
  'dhea-s':'dhea sulfate','dheas':'dhea sulfate','dehydroepiandrosterone sulfate':'dhea sulfate','dhea sulphate':'dhea sulfate',
  'sex hormone binding globulin':'shbg',
  'epo':'erythropoietin',
  'afp':'alpha fetoprotein','alpha-fetoprotein':'alpha fetoprotein',
  'carcinoembryonic antigen':'cea',
  'ca19-9':'ca 19-9','ca-19-9':'ca 19-9','ca 19 9':'ca 19-9',
  'ca125':'ca 125','ca-125':'ca 125',
  'ca27-29':'ca 27-29','ca 27 29':'ca 27-29',
  'b2 microglobulin':'beta 2 microglobulin','beta-2 microglobulin':'beta 2 microglobulin','b2m':'beta 2 microglobulin',
  'immunoglobulin a':'iga','immunoglobulin g':'igg','immunoglobulin m':'igm','immunoglobulin e':'ige',
  'c3':'complement c3','c4':'complement c4','c3 complement':'complement c3','c4 complement':'complement c4',
  'total complement':'ch50','complement ch50':'ch50',
  'ra factor':'rheumatoid factor','rheumatoid arthritis factor':'rheumatoid factor',
  'anti-ccp':'anti ccp','cyclic citrullinated peptide':'anti ccp','ccp antibody':'anti ccp',
  'anti-dsdna':'anti dsdna','double stranded dna antibody':'anti dsdna','ds dna':'anti dsdna',
  'aso':'aso titer','antistreptolysin o':'aso titer','antistreptolysin o titre':'aso titer','aso titre':'aso titer',
  'angiotensin converting enzyme':'ace','serum ace':'ace',
  'serum tryptase':'tryptase',
  'antithrombin iii':'antithrombin','at iii':'antithrombin','antithrombin activity':'antithrombin',
  'protein c activity':'protein c','protein s activity':'protein s',
  'factor 8':'factor viii','antihemophilic globulin':'factor viii',
  'vwf':'von willebrand factor','von willebrand factor activity':'von willebrand factor','ristocetin cofactor':'von willebrand factor',
  'fdp':'fibrin degradation products',
  'reticulocyte count absolute':'absolute reticulocyte','absolute retic':'absolute reticulocyte',
  'ipf':'immature platelet fraction',
  'glucose 6 phosphate dehydrogenase':'g6pd','g 6 pd':'g6pd',
  'cd4':'cd4 count','cd4 t cell':'cd4 count','cd4+ t-lymphocyte count':'cd4 count','cd4 t-lymphocyte count':'cd4 count',
  'cd8':'cd8 count','cd3':'cd3 count',
  'hba2':'hb a2','hemoglobin a2':'hb a2','haemoglobin a2':'hb a2',
  'hbf':'hb f','hemoglobin f':'hb f','haemoglobin f':'hb f','fetal hemoglobin':'hb f',
  'viscosity':'serum viscosity','viscosity, serum':'serum viscosity',
  'csf glucose level':'csf glucose','glucose, csf':'csf glucose',
  'csf total protein':'csf protein','proteins, csf total':'csf protein','total proteins, csf':'csf protein',
  'csf leukocytes':'csf cell count','csf wbc':'csf cell count','cell count, csf':'csf cell count',
  'chloride, csf':'csf chloride','opening pressure':'csf pressure',
  'ph, urine':'urine ph',
  'oxalate, urine':'urine oxalate','citrate, urine':'urine citrate',
  'uric acid, urine':'urine uric acid','urea nitrogen, urine':'urine urea nitrogen',
  'calcium, urine':'urine calcium','creatine, urine':'urine creatine',
  'acr':'albumin creatinine ratio','albumin to creatinine ratio':'albumin creatinine ratio','urine acr':'albumin creatinine ratio',
  'body mass index':'bmi',
  'anion gap, serum':'anion gap',
  'beta-hydroxybutyrate':'beta hydroxybutyrate','beta hydroxy butyrate':'beta hydroxybutyrate','ketones':'beta hydroxybutyrate',
  'mma':'methylmalonic acid',
  'lactic acid, serum':'lactic acid','lactate, serum':'lactate','serum lactate':'lactate',
  'bone specific alp':'bone specific alkaline phosphatase','bsap':'bone specific alkaline phosphatase',
  'ntx':'n telopeptide','n-telopeptide':'n telopeptide',
  '1,5 ag':'1,5 anhydroglucitol','1,5-anhydroglucitol':'1,5 anhydroglucitol',
  'creatinine clearance, urine':'creatinine clearance','crcl':'creatinine clearance',
  'hdl cholesterol':'hdl','cholesterol hdl':'hdl','hdl - c':'hdl','hdl-c':'hdl',
  'ldl cholesterol':'ldl','cholesterol ldl':'ldl','ldl - c':'ldl','ldl-c':'ldl',
  'vldl cholesterol':'vldl','non hdl cholesterol':'non-hdl',
  'serum cholesterol':'total cholesterol','cholesterol total':'total cholesterol',
  'serum creatinine':'creatinine','creatinine serum':'creatinine',
  'serum urea':'urea','blood urea':'urea','serum uric acid':'uric acid',
  'white blood cell':'total leucocytes','total wbc':'total leucocytes','wbc count':'total leucocytes',
  'red blood cell':'erythrocyte','rbc count':'erythrocyte',
  'aspartate aminotransferase':'sgot','alanine aminotransferase':'sgpt',
  'aspartate transaminase':'sgot','alanine transaminase':'sgpt',
  'gamma gt (ggtp)':'gamma gt','ggtp':'gamma gt','ggt':'gamma gt',
  'alkaline phosphatase, serum':'alkaline phosphatase',
  'proteins, serum':'total protein','total proteins':'total protein','serum protein':'total protein',
  'platelet count':'platelet',
  'neutrophil lymphocyte ratio':'neutrophil lymphocyte ratio',
  'serum albumin':'albumin',
  'thyroid stimulating hormone':'tsh',
  'glycosylated hemoglobin':'hba1c','glycated haemoglobin':'hba1c','glycosylated haemoglobin':'hba1c',
  'blood sugar fasting':'fasting blood sugar','fasting plasma glucose':'fasting blood sugar','glucose fasting':'fasting blood sugar',
  'post prandial':'postprandial','2 hour post prandial':'postprandial',
  'vitamin b-12':'vitamin b12','vit b12':'vitamin b12','vit d':'vitamin d',
  '25 hydroxy vitamin d':'vitamin d','25-oh vitamin d':'vitamin d','vitamin d total':'vitamin d','vitamin d 25 oh':'vitamin d',
  'c reactive protein':'c-reactive protein','crp':'c-reactive protein','high sensitivity crp':'hs-crp',
  'erythrocyte sedimentation rate':'esr','sedimentation rate':'esr',
  'serum ferritin':'ferritin','iron binding capacity':'tibc',
  'serum calcium':'calcium','serum sodium':'sodium','serum potassium':'potassium',
  'serum magnesium':'magnesium','serum phosphorus':'phosphorus',
  'pt (inr) value':'inr','pt (inr)':'inr','pt inr value':'inr','inr value':'inr',
  'partial thromboplastin':'aptt',
  'prostate specific antigen':'psa',
  'urine protein':'urine - protein','urine creatinine':'urine - creatinine',
  'protein creatinine ratio':'protein/creatinine ratio','urine protein creatinine ratio':'protein/creatinine ratio',
  'bilirubin- indirect':'bilirubin indirect','bilirubin - indirect':'bilirubin indirect',
  'kappa- free light chain':'kappa free light chain','lambda- free light chain':'lambda free light chain',
  // RDW is reported as either the SD or CV variant; either way it's the same marker.
  'rdw sd':'red cell distribution width','rdw cv':'red cell distribution width','rdw-sd':'red cell distribution width','rdw-cv':'red cell distribution width',
  // Common alternate spelling.
  'serum phosphorous':'phosphorus','phosphorous':'phosphorus',
  // Bilirubin's Total/Direct/Indirect qualifier is semantically essential (three
  // different values), unlike a decorative "(AST)"-style alias -- so these are
  // matched via the PARENTHESIS-preserving loose-name path, not the generic
  // parenthesis-stripping one.
  'bilirubin (total)':'bilirubin total','bilirubin (direct)':'bilirubin direct','bilirubin (indirect)':'bilirubin indirect',
  's.bilirubin (total)':'bilirubin total','s.bilirubin (direct)':'bilirubin direct','s.bilirubin (indirect)':'bilirubin indirect',
  // A differential count's "(ABS COUNT)" / "(ABSOLUTE COUNT)" row is a DIFFERENT
  // marker from the plain % row above it -- route it to the dedicated absolute-
  // count entry the library already has, instead of colliding with the % version.
  'neutrophils (abs count)':'absolute neutrophil','neutrophils (absolute count)':'absolute neutrophil',
  'lymphocytes (abs count)':'absolute lymphocyte','lymphocytes (absolute count)':'absolute lymphocyte',
  'monocytes (abs count)':'absolute monocyte','monocytes (absolute count)':'absolute monocyte',
  'eosinophils (abs count)':'absolute eosinophil','eosinophils (absolute count)':'absolute eosinophil',
  'basophils (abs count)':'absolute basophil','basophils (absolute count)':'absolute basophil',
  // Real-world spelling/abbreviation variants seen on actual reports.
  'cholestrol/hdlc ratio':'cholesterol hdl ratio','cholesterol/hdl ratio':'cholesterol hdl ratio',
  // The name is split across two lines in this report's eAG row ("Estimated
  // Average" / "Glucose(eAG)"), with the VALUE appearing on the first
  // fragment -- before the name is even complete. Alias the truncated
  // fragment directly rather than rely on wrapped-name stitching (which is
  // built for the opposite order: name completing BEFORE the value).
  'estimated average':'estimated average glucose',
  'total cholestrol/hdlc ratio':'cholesterol hdl ratio','total cholesterol/hdl ratio':'cholesterol hdl ratio',
  'chol/hdl ratio':'cholesterol hdl ratio','tc/hdl ratio':'cholesterol hdl ratio',
  'ldl/hdl ratio':'ldl hdl ratio','hdl/ldl ratio':'hdl ldl ratio',
  'ast/alt ratio':'ast alt ratio','sgot/sgpt ratio':'ast alt ratio',
  'bun/creatinine ratio':'bun creatinine ratio',
  'estimated glomerular filtration rate':'egfr',
  'unbound iron binding capacity':'uibc','unsaturated iron binding capacity':'uibc',
  'very low density lipoprotein':'vldl','alanine transaminase':'sgpt',
  'triiodothyronine t3 total':'total t3','thyroxine t4 total':'total t4'
};

// Several spellings/synonyms exist as separate library keys (e.g. 'tsh' and
// 'thyroid stimulating hormone', 'hemoglobin' and 'haemoglobin'). They share a
// display name, so collapse them onto ONE canonical key — otherwise the same
// marker from two different labs would split into two separate trend lines.
const CANON_BY_NAME=(()=>{const m={};for(const k of Object.keys(STANDARD_RANGES)){const n=STANDARD_RANGES[k].name;if(!(n in m))m[n]=k}return m})();
const std_=k=>Object.assign({},STANDARD_RANGES[k],{key:CANON_BY_NAME[STANDARD_RANGES[k].name]||k});
const ABBR_INDEX=(()=>{const ix={};for(const k of Object.keys(STANDARD_RANGES))for(const a of (STANDARD_RANGES[k].abbr||[]))if(!ix[a])ix[a]=k;return ix})();
// Every searchable phrase, longest-first so the most specific wins.
const LOOKUP=Object.keys(STANDARD_RANGES).map(k=>({p:k,key:k}))
  .concat(Object.keys(ALIASES).map(p=>({p,key:ALIASES[p]})))
  .sort((a,b)=>b.p.length-a.p.length)
  // Short alias abbreviations (epo, aso, crp, hgh...) are real English letter
  // sequences that show up INSIDE ordinary words -- "epo" is the first three
  // letters of "report", "aso" sits inside "reason". A plain substring test
  // (clean.includes(e.p)) matches those every time, misreading a header line
  // like "Report Ref. ID : ..." as an Erythropoietin result. Longer canonical
  // names (multi-word test names) aren't at meaningful risk of this, so only
  // short (<=4 char) patterns get the stricter word-boundary check.
  .map(e=>e.p.length<=4?Object.assign(e,{boundaryRe:new RegExp('(?:^|[^a-z0-9])'+e.p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z0-9])')}):e);

// Normalize a raw name fragment: lowercase, drop parentheticals/punctuation, collapse spaces.
function normName(s){
  return String(s||'').toLowerCase()
    // Collapse dotted abbreviations: "r.b.c." -> "rbc", "l.d.l." -> "ldl",
    // "s.g.o.t" -> "sgot" — a run of 2+ "single letter + period" groups is
    // always an abbreviation being spelled out, never real prose.
    .replace(/\b(?:[a-z]\.){2,}/g, m => m.replace(/\./g,''))
    .replace(/\([^)]*\)/g,' ')      // drop (Hb), (AST), (Diazo method)…
    .replace(/[:*]/g,' ')
    .replace(/-/g,' ')               // "Gamma-GT" -> "gamma gt", "RDW-SD" -> "rdw sd"
    .replace(/[^a-z0-9/+ .]/g,' ')
    .replace(/\s+/g,' ').trim();
}
// Match a name fragment to the library. Returns {key,name,...} or null.
// Some names carry their meaning INSIDE the brackets — "PT(INR) Value" is the INR,
// not the prothrombin time. So try the name with brackets intact first, then the
// bracket-stripped form (which is what makes "Haemoglobin (Hb)" etc. work).
function looseName(s){
  return String(s||'').toLowerCase()
    .replace(/[:*#]/g,' ')
    .replace(/[^a-z0-9()/+\- .]/g,' ')
    .replace(/\s+/g,' ').trim();
}
// Tidy up the label exactly as the report prints it, for display.
function cleanLabel(raw){
  return String(raw||'')
    .replace(/\s+/g,' ')
    .replace(/[\s:,\-#*]+$/,'')      // trailing punctuation/flag separators
    .replace(/\s+[HL]$/,'')          // a dangling H / L flag
    .trim().slice(0,90);
}
function matchTest(rawName){
  const loose=looseName(rawName);
  // Ratio labels often contain the full component analyte names, which would
  // otherwise win the generic longest-phrase lookup before the trailing ratio
  // abbreviation is considered.
  if(/\b(?:total\s+)?cholesterol\s*\/\s*(?:high\s+density\s+lipoprotein|hdl)|\bchol\s*\/\s*hdl\b/i.test(loose))return std_('cholesterol hdl ratio');
  if(/\bldl\s*\/\s*hdl\b/i.test(loose))return std_('ldl hdl ratio');
  if(/\bhdl\s*\/\s*ldl\b/i.test(loose))return std_('hdl ldl ratio');
  if(/\b(?:ast\s*\/\s*alt|sgot\s*\/\s*sgpt)\b/i.test(loose))return std_('ast alt ratio');
  if(/\bbun[-\s]*\/\s*creatinine\b/i.test(loose))return std_('bun creatinine ratio');
  if(loose.length>=2){
    if(STANDARD_RANGES[loose])return std_(loose);
    for(const e of LOOKUP){if(e.p.includes('(')&&loose.includes(e.p))return std_(e.key)}
  }
  const clean=normName(rawName);
  if(!clean||clean.length<2)return null;
  if(STANDARD_RANGES[clean])return std_(clean);
  for(const e of LOOKUP){if(e.boundaryRe?e.boundaryRe.test(clean):clean.includes(e.p))return std_(e.key)}
  const bare=clean.replace(/[^a-z0-9]/g,'');
  if(ABBR_INDEX[bare])return std_(ABBR_INDEX[bare]);
  return null;
}
// Back-compat name used elsewhere.

// Reference-range text -> {min,max}
function parseRefRange(txt){
  if(txt==null)return null;
  let t=String(txt).replace(/,/g,'').replace(/(\d)\.\s+(\d)/g,'$1.$2').trim(); // fix "0. 44"
  // A genuine multi-tier qualitative block ("Desirable: <200 / Borderline High:
  // 200-239 / High: >239") has 2+ distinct tier segments, each with its OWN
  // numeric boundary. Picking any ONE of those numbers as "the" reference range
  // is actively misleading — e.g. grabbing "150-199" (Borderline High) as if it
  // were the normal range for a Triglycerides result of 128.9 would wrongly
  // flag a NORMAL result as "low". When 2+ tier keywords are present, refuse to
  // guess a range at all — fall back to the library default instead, per this
  // app's standing rule: no range beats a wrong one.
  const tierHits=(t.match(new RegExp(TIER_WORDS_RE.source,'gi'))||[]).length;
  if(tierHits>=2)return null;
  let m=/(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)/.exec(t);
  if(m&&!/^\s*<|>/.test(t))return{min:parseFloat(m[1]),max:parseFloat(m[2])};
  m=/<\s*=?\s*(-?\d+(?:\.\d+)?)/.exec(t); if(m)return{min:0,max:parseFloat(m[1])};
  m=/>\s*=?\s*(-?\d+(?:\.\d+)?)/.exec(t); if(m)return{min:parseFloat(m[1]),max:Infinity};
  // Some lab PDFs decode a printed comparison glyph as NUL; the PDF reader
  // normalizes that glyph to "-". In an isolated trailing reference token,
  // "- 50" means an upper limit, not a negative result.
  m=/^\s*[-–—]\s*(\d+(?:\.\d+)?)\s*$/.exec(t); if(m)return{min:0,max:parseFloat(m[1])};
  return null;
}
// A "classifier" line prints category LABELS, each with its own comparison
// operand ("Beta Thalassemia trait: < 14" / "Iron deficiency anaemia: >= 14"),
// rather than a single normal range. The number is a diagnostic discriminant
// threshold, not a value where "further from normal = worse" -- a Mentzer
// Index of 17.7 isn't "more abnormal" than 14.1, it just also sits >= the
// cutoff. Treating this like an ordinary lab value (library-default 0..max,
// flag HIGH above it) is technically not wrong but frames it with the same
// urgency as a real high/low lab result, which is misleading. Detected
// generically (2+ distinctly-labelled thresholds) so it works for any
// report's index/score field, not just ones hardcoded into the library.
function detectClassifier(rangeTxt,val){
  if(!isFinite(val))return null;
  const re=/([A-Za-z][A-Za-z .\/-]{2,40}?):\s*(<=|>=|=<|=>|<|>)\s*(-?\d+(?:\.\d+)?)/g;
  const segs=[];let m;
  while((m=re.exec(String(rangeTxt||'')))){
    // Strip a leading method annotation ("Calculated", "Serum"...) that can
    // land between two classifier segments during multi-line text reconstruction.
    const label=m[1].trim().replace(METHOD_RE,'').trim();
    if(TIER_WORDS_RE.test(label))return null;   // that's a severity tier (Desirable/Borderline/High…), not a classifier
    segs.push({label,op:m[2],num:parseFloat(m[3])});
  }
  if(segs.length<2)return null;
  if(new Set(segs.map(s=>s.label.toLowerCase())).size<2)return null;
  const cmp={'<':(v,n)=>v<n,'<=':(v,n)=>v<=n,'=<':(v,n)=>v<=n,'>':(v,n)=>v>n,'>=':(v,n)=>v>=n,'=>':(v,n)=>v>=n};
  const hit=segs.find(s=>cmp[s.op]&&cmp[s.op](val,s.num));
  return {label:hit?hit.label:'Pattern not classified by the printed cutoffs'};
}
function statusFor(val,min,max){
  if(max!=null&&isFinite(max)&&val>max)return'high';
  if(min!=null&&isFinite(min)&&val<min)return'low';
  return'normal';
}
function statusForQualified(val,min,max,qualifier){
  // A limit result is an interval, not the number printed after its symbol.
  // Classify only when every possible value lies on the same side of a bound.
  if(qualifier==='<'||qualifier==='≤'||qualifier==='<='||qualifier==='=<'){
    if(min!=null&&(qualifier==='<'?val<=min:val<min))return 'low';
    if(min==null&&max!=null&&val<=max)return 'normal';
    return 'unknown';
  }
  if(qualifier==='>'||qualifier==='≥'||qualifier==='>='||qualifier==='=>'){
    if(max!=null&&isFinite(max)&&(qualifier==='>'?val>=max:val>max))return 'high';
    if(min!=null&&val>=min&&(max==null||!isFinite(max)))return 'normal';
    return 'unknown';
  }
  return statusFor(val,min,max);
}
function normalizedUnit(unit){
  return String(unit||'').toLowerCase().replace(/[µμ]/g,'u').replace(/gm\//g,'g/').replace(/\s+/g,'').replace('³','3');
}
function comparableUnit(observed,standard){return !observed||!standard||normalizedUnit(observed)===normalizedUnit(standard)}

// Strip units / ranges / flags so the lone remaining number is the value.
// Also strips spelled-out range boundaries ("More than 239", "Less than 200", "Up to 38")
// that appear in tiered-reference rows on Indian lab reports. Without this, extractValue
// finds the threshold number before the forward scan reaches the actual ": VALUE" line.
const RANGE_RE=/(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)|[<>]\s*=?\s*\d+(?:\.\d+)?|\b(?:more\s+th(?:a[nt]?)?|less\s+th(?:a[nt]?)?|up\s*to|upto|above|below)\s+\d+(?:\.\d+)?/gi;
const UNIT_RE=/(?:^|\s)10\s*\^?\s*\d+\s*\/\s*u?l\b|mil\s*\/\s*cu\.?\s*mm|cells?\s*\/\s*cu\.?\s*mm|\/\s*(?:hpf|lpf|cu\.?mm)|[a-zµ]{2,6}\s*\/\s*[a-zµ.]{1,8}|\bg\s*\/\s*d[lL]\b|%|\bfl\b|\bpg\b|\bsec\b|\bm[lL]\b|\bratio\b|\bindex\b|\bgm\/d[lL]\b|\buiu\b|\bmmol\b|\bng\b|\bug\b|\biu\b/gi;
// A qualitative, tiered reference block ("Desirable: Less than 200 / Borderline
// High: 200-239 / High: More than 239") carries its OWN threshold numbers loose
// in prose, outside any recognisable "N-N" range shape — those survive naive
// range-stripping and can be mistaken for the result. This report format (and
// many Indian lab templates for Cholesterol/Triglycerides/HDL/LDL) always
// A tiered qualitative reference block ("Desirable: Less than 200 /
// Borderline High: 200-239 / High: More than 239") has its own standalone
// numbers embedded in prose. This regex is kept ONLY so parseRefRange (a
// separate function) can detect "this reference text has multiple tiers,
// don't trust a single extracted range from it" -- it is NOT used here for
// value-extraction any more. The real report layout is "NAME : VALUE UNIT
// [trailing tier text]", and the value is always the number immediately
// followed by a unit -- which the ordinary number-then-unit search (in the
// caller, before extractValue is ever invoked) already finds correctly.
// An earlier version of this function special-cased "take the number after
// the LAST colon", assuming tier text came BEFORE the value -- but real
// reports put the tiered description AFTER the value, each tier line having
// its OWN colon, so that rule was grabbing a tier boundary instead of the
// real result. Removed.
const TIER_WORDS_RE=/\b(desirable|borderline|optimal|near\/above|very high|very low|pre-?diabetes|uncontrolled|deficient|insufficient|sufficient|toxicity|toxic|less than|more than|up ?to)\b/i;
// Organism/parasite-positive smear findings — deliberately independent of digit
// content (see call site) because a positive result is usually printed WITH an
// embedded parasite index/count that must never be read as "the value".
// NOTE: the gap between organism and verb deliberately allows "." (medical
// abbreviations like "Pl. falciparum" contain one) — only "\n" is excluded,
// which line-by-line input never contains anyway; this is just a length cap.
const PARASITE_POSITIVE_RE=/\b(trophozoites?|gametocytes?|schizonts?|ring\s*forms?|microfilari\w*)\b[^\n]{0,40}?\b(seen|detected|present|found|isolated)\b|\bplasmodium\s*(falciparum|vivax|malariae|ovale|knowlesi)\b[^\n]{0,40}?\b(seen|detected|present|positive)\b/i;
function extractValue(dataStr){
  const raw=String(dataStr||'');
  let s=' '+raw+' ';
  s=s.replace(/(\d)\.\s+(\d)/g,'$1.$2');      // "0. 44" -> "0.44"
  s=s.replace(RANGE_RE,' ');                   // remove reference ranges
  s=s.replace(UNIT_RE,' ');                    // remove units
  s=s.replace(/\b[hHlL]\b/g,' ');              // remove stray H/L flags
  // A real result is never glued directly onto letters -- it's always its own
  // token, separated by whitespace/punctuation. Without the lookaround guards
  // below, this would happily match the "1" inside "HbA1C" or the "12" inside
  // "B12" when a multi-line scan (in the caller) glues an unrelated heading
  // like a bare "Vitamin B12" or "Glycated Hemoglobin (HbA1C)" line into the
  // search text -- silently returning a fake, wrong result.
  const m=s.match(/(?<![A-Za-z0-9])-?\d+(?:\.\d+)?(?![A-Za-z0-9])/);
  return m?parseFloat(m[0]):null;
}
// colonValue: finds the actual result on a ": VALUE UNIT" style separator line.
// A standalone colon (not preceded by an alphanumeric) marks the true result in
// tiered-reference rows like "Total Cholesterol Desirable: Less than 200 … : 261.0 mg/dl".
// The (?![\d.]) guard after the digits prevents the backtracking bug where "200"
// partially matched as "20" (satisfying a lookahead by giving up one digit).
function colonValue(dataStr){
  const m=/(^|[^A-Za-z0-9]):\s*(-?\d+(?:\.\d+)?)(?![\d.])/.exec(String(dataStr||''));
  return m?parseFloat(m[2]):null;
}

// Lines that are annotations, not data — skip while assembling a record.
const METHOD_RE=/^\(?\s*(serum|plasma|calculated|diazo|biuret|method|multipoint|bromocresol|enzymatic|ifcc|turbidimetry|citrated|bpb|pnpp|bcg|w\/o|p-nitrophenyl|capillary electrophoresis|electrochemiluminescence|according to|first trimester|second and|reference ranges are)/i;
const STOP_RE=/^\s*(interpretation|note|remark|caution|comment|method|test done|kindly|increased|reports? to follow|end of report|instant\s*:|page\s*:|\d+\.\s|\*|-{3,})/i;
// Header / demographic / specimen / timestamp lines. These contain numbers (dates, IDs,
// lab numbers) that must NEVER be picked up as a test result.
const HEADER_RE=/patient|referral|collection date|collection time|receiving date|authorised|authorized|reporting time|sample id|specimen no|specimen type|container|source|age\s*\/|gender|\bdob\b|\burn\b|lab no|physician|patient location|passport|registered on|collected on|reported on|billed on|vid no|pid no|\bp\.?\s*i\.?\s*d\.?\b|\bv\.?\s*i\.?\s*d\.?\b|client\s*id|referred by|ref\.?\s*by|contact no|address|pin\s*code|investigation\b|parameters\b|observed value|biological reference|ref\.\s*range|test\s+result|test name\b|scan to|processing location|page \d|provisional|medical laboratory|department of|hospital|www\.|@|license no|licence no|reg\.?\s*no|\bmmc\s*no\b|\bmc-\d|regd|consultant|\bhod\b|\bm\.?d\.?\s*\(|\bdr\.|signature|tel \+|fax|po box|instant\s*:|clinical chemistry|immunology\b|haematology\b|hematology\b|print(?:ed)?\s*by|electronically authenticated|this is an? .*report\b|centre:|laboratory\s*:|ilac|nabl|\bcin\b|\bgst\b|please use|future ref/i;
// Marketing/app-store boilerplate seen on consumer-facing lab report PDFs (a
// cover or index page listing panel names with NO values yet, sitting right
// next to promo badges like star ratings and review counts). Left in, a bare
// test-name heading on that page (e.g. "Vitamin B12" in a table of contents)
// can have its forward value-scan wander into this text and seize on "4.9"
// from "Rated 4.9/5 on Google" as if it were the actual result -- a wrong
// clinical value, not just clutter. Filtered in the same pre-clean pass as
// HEADER_RE, before any test name ever gets matched against these lines.
const PROMO_RE=/rated\s+[\d.]+\s*\/\s*\d|\breviews?\)?$|available in \d+\+?\s*cit(y|ies)|trusted by [\d,]+\+?\s*doctors?|reports? in your pocket|download\s+(the\s+)?app\b|google play|app store|\bindex\b\s*$/i;
// A number that is really part of a date or a time, e.g. 16/06/2026 or 13:04
const DATETIME_RE=/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*-\d{2,4}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b|\b\d{2,3}Y\s*\d{1,2}M\b/gi;

function parseBloodPressure(text,out,seen){
  // "BP: 148/92 mmHg", "Blood Pressure 130 / 85"
  const re=/(?:blood\s*pressure|\bbp\b)[^0-9]{0,12}(\d{2,3})\s*\/\s*(\d{2,3})/ig;
  let m;
  while((m=re.exec(text))){
    const sys=parseInt(m[1],10), dia=parseInt(m[2],10);
    if(!(sys>=60&&sys<=260&&dia>=30&&dia<=180))continue;
    const line=String(m[0]).trim();
    if(!seen.has('systolic')){
      seen.add('systolic');
      out.push({key:'systolic',name:'Blood Pressure (Systolic)',group:'cardiac',value:sys,unit:'mmHg',
        min:90,max:120,normal_range:'90 - 120 mmHg',rangeNote:'general adult range',known:true,
        status:statusFor(sys,90,120),srcLine:line,srcIndex:-1});
    }
    if(!seen.has('diastolic')){
      seen.add('diastolic');
      out.push({key:'diastolic',name:'Blood Pressure (Diastolic)',group:'cardiac',value:dia,unit:'mmHg',
        min:60,max:80,normal_range:'60 - 80 mmHg',rangeNote:'general adult range',known:true,
        status:statusFor(dia,60,80),srcLine:line,srcIndex:-1});
    }
    break;
  }
}
// Markdown pipe-tables (|Name|Value|Unit|Range|) carry unambiguous column
// boundaries, but the general line parser below was built around prose-style
// "Name Range : Value Unit" rows and colon-joined "Name:Value" rows -- fed a
// raw table row it can badly cross-contaminate rows (confirmed: it was
// pairing one test's NAME with the NEXT row's VALUE). Rather than write a
// second, parallel extraction path (risking it drifting out of sync with the
// severity/plausibility/dedup logic below), rewrite each table row into the
// exact shape the existing parser already handles correctly, before anything
// else runs.
function flattenMarkdownTableRows(text){
  const src=String(text||'').split(/\r?\n/);
  const out=[];
  for(const raw of src){
    const line=raw.trim();
    if(line.indexOf('|')<0){ out.push(raw); continue; }
    let cells=line.split('|').map(c=>c.trim());
    if(cells.length && cells[0]==='')cells=cells.slice(1);
    if(cells.length && cells[cells.length-1]==='')cells=cells.slice(0,-1);
    if(cells.length<2){ out.push(raw); continue; }
    const isSeparator=cells.every(c=>c===''||/^:?-+:?$/.test(c));
    if(isSeparator)continue; // markdown table divider row -- carries no data
    const [name,value='',unit='',range='']=cells;
    const isNumericValue=/^-?\d+(?:\.\d+)?$/.test(value);
    if(isNumericValue && name){
      out.push(`${name} ${range} : ${value} ${unit}`.replace(/\s+/g,' ').trim());
    } else {
      // Header row ("Test|Result|Unit|Reference") or a text-only finding
      // ("Red Cell Morphology|Hypochromic Microcytic||") -- flatten the
      // markup anyway; a header row's cells are all-alphabetic, so the
      // result has no digits and the existing zero-digit guard downstream
      // correctly excludes it from ever being treated as a result row.
      out.push([name,value,unit,range].filter(Boolean).join(' ').replace(/\s+/g,' ').trim());
    }
  }
  return out.join('\n');
}

// PDF generators commonly wrap a long test label onto the next visual baseline
// while leaving VALUE and RANGE on the first one. Rejoin only when the combined
// label resolves to a *more specific* known analyte. This avoids broad, report-
// specific exceptions and leaves ordinary method/unit continuation lines alone.
function assembleWrappedResultLabels(inputLines){
  const out=inputLines.slice(), consumed=new Set();
  for(let i=0;i<out.length-1;i++){
    if(consumed.has(i))continue;
    const line=out[i], next=out[i+1];
    const nums=line.match(/-?\d+(?:\.\d+)?/g)||[];
    if(nums.length<2||/\d/.test(next)||STOP_RE.test(next)||HEADER_RE.test(next))continue;
    const firstNum=line.search(/[<>]?\s*-?\d+(?:\.\d+)?/);
    if(firstNum<=1)continue;
    const label=line.slice(0,firstNum).trim(), tail=line.slice(firstNum).trim();
    const current=matchTest(label);
    const continuation=next.replace(METHOD_RE,'').replace(/^[-–—:\s]+/,'').trim();
    if(!continuation||continuation.length>80||!/\b(concentration|ratio|rate|cholesterol|lipoprotein|filtration|capacity)\b|\b[A-Z]{2,6}\b/.test(continuation))continue;
    const joined=`${label} ${continuation}`.replace(/\s+/g,' ').trim();
    const improved=matchTest(joined);
    if(!improved)continue;
    // Merge when it discovers a different analyte (MCH -> MCHC), or when the
    // first fragment was not recognized at all (wrapped ratio/eGFR labels).
    if(!current||improved.key!==current.key){
      out[i]=`${joined} ${tail}`;
      consumed.add(i+1);
    }
  }
  return out.filter((_,i)=>!consumed.has(i));
}
// Some laboratory PDF generators place the analyte label on one visual row and
// its value/range on the next. Rejoin only a recognized label with an adjacent
// measurement row. This is deliberately stricter than the parser's forward
// scan: it cannot turn arbitrary prose or a section heading into a result.
function assembleSplitResultRows(inputLines){
  const out=inputLines.slice(), consumed=new Set();
  const measurement=/[<>]?\s*-?\d+(?:\.\d+)?\s*(?:10\s*(?:\^|[³⁶⁹])|[a-zµ%/])|[<>]?\s*-?\d+(?:\.\d+)?\s+[-–—]?\s*-?\d+(?:\.\d+)?/i;
  for(let i=0;i<out.length-1;i++){
    if(consumed.has(i)||/\d/.test(out[i]))continue;
    const genericProtein=/^protein$/i.test(out[i]);
    const std=matchTest(out[i])||(genericProtein?std_('total protein'):null);
    if(!std)continue;
    for(let j=i+1;j<=Math.min(out.length-1,i+2);j++){
      const next=out[j];
      if(!next||HEADER_RE.test(next)||STOP_RE.test(next))break;
      if(!measurement.test(next)){
        if(METHOD_RE.test(next))continue;
        break;
      }
      // A following row that already names a known analyte belongs to itself
      // (for example a section heading "HbA1c" before "HBA1C# 5.5 %").
      const firstNumber=next.search(/[<>]?\s*-?\d/);
      const nextLabel=firstNumber>0?next.slice(0,firstNumber):'';
      if(nextLabel && matchTest(nextLabel) && !METHOD_RE.test(next))break;
      let valueRow=next;
      if(METHOD_RE.test(next)){
        // Method names can contain numbers ("Pyridoxal-5-") before the real
        // result. Retain only the first number that is directly followed by a
        // measurement unit, plus the reference range after it.
        const measured=/(?:^|\s)([<>]?\s*-?\d+(?:\.\d+)?)(?=\s+(?:10\s*(?:\^|[³⁶⁹])|[a-zµ%/]))/i.exec(next);
        if(!measured)break;
        valueRow=next.slice(measured.index).trim();
      }
      const label=genericProtein?'Total Protein':out[i];
      out[i]=`${label} ${valueRow}`.replace(/\s+/g,' ').trim();
      consumed.add(j);
      break;
    }
  }
  return out.filter((_,i)=>!consumed.has(i));
}
function parseReportText(text,profile){
  text=flattenMarkdownTableRows(text);
  const P=profile||{sex:null,age:null};
  const metrics=[], seen=new Set();
  const rawLines=String(text||'').split(/\r?\n/);
  const currentBeforePrevious=rawLines.some(l=>/\bcurrent\b.*\bprevious\b/i.test(l));
  // Pre-clean: trim, drop blank & header & watermark-fragment lines.
  let lines=[];
  for(let ln of rawLines){
    let t=ln.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();
    // Decimal commas are common in reports. Three trailing digits are left alone
    // because they may be a thousands separator rather than a decimal.
    t=t.replace(/(\d),(\d{1,2})(?!\d)/g,'$1.$2');
    if(!t)continue;
    if(HEADER_RE.test(t))continue;
    if(PROMO_RE.test(t))continue;
    t=t.replace(DATETIME_RE,' ').replace(/\s+/g,' ').trim();   // dates/times are never results
    if(!t)continue;
    if(/^[A-Z]{1,3}$/.test(t))continue;               // watermark shards: PR, OV, AL, N…
    lines.push(t);
  }
  // Resolve the explicit "label on row A, value on row B" shape first so a
  // numeric method row cannot be mistaken for the first half of the next label.
  lines=assembleWrappedResultLabels(assembleSplitResultRows(lines));

  const PROSE_START=/^\s*(interpretation|note\b|notes\b|remark|comment|caution|reference\b|interference|increased .* may be due to|decreased .* may be due to|clinical significance|test done|kindly)/i;
  // A line that genuinely looks like a result row: a number carrying a unit or a range.
  // A genuine table row: starts with a label, then a value, and is short.
  // Deliberately strict — prose sentences mention units too ("7 to 17 mg/dl").
  const isDataRow=l=>{
    if(!/^[A-Za-z(]/.test(l))return false;
    const words=(l.match(/[A-Za-z]{2,}/g)||[]).length;
    if(words>7)return false;
    if(/\b(is|are|was|were|may|can|from|than|the|of|and|with|for)\b/i.test(l))return false;
    return /^[^0-9]{2,45}\s+[<>]?\s*-?\d/.test(l);
  };
  let inProse=false;
  const consumed=new Set();

  for(let i=0;i<lines.length;i++){
    if(consumed.has(i))continue;
    const line=lines[i];
    // Interpretation / caution / reference paragraphs mention test names ("...(Factor II,
    // V, X & Fibrinogen)", "Interference in PT/INR") but contain no results. Anchoring on
    // them let the scan run on and pick up a doctor's Reg No. as a value. Stay in "prose"
    // mode until a line that actually looks like a measurement row.
    if(PROSE_START.test(line)){inProse=true;continue}
    if(inProse){
      const bareKnown=!/\d/.test(line)&&(line.match(/[A-Za-z]{2,}/g)||[]).length<=5&&!!matchTest(line);
      if(isDataRow(line)||bareKnown)inProse=false; else continue;
    }
    // A method annotation ("Serum, Biuret", "(Citrated Plasma )") carries no result.
    // But a TEST called "Serum Creatinine  1.15  mg/dL" starts with the same word and
    // is a real row — so only treat it as an annotation if it has no measurement on it.
    const lineHasValue=/\d/.test(line)&&(/\d\s*%/.test(line)||/\d\s*[-–]\s*\d/.test(line)||/[<>]\s*=?\s*\d/.test(line)||/\d\s*(?:[a-zµ]{1,8}\s*\/[a-zµ.0-9]{1,8}|(?:sec|fL|pg|mg|ng|ug|gm|mmol|nmol|pmol|ratio|mIU|uIU|IU|mil|cell)\b)/i.test(line));
    if(STOP_RE.test(line))continue;
    if(METHOD_RE.test(line)&&!lineHasValue)continue;
    // A prescription line is NOT a lab result. "Tab. Augmentin 625mg twice daily x 7 days"
    // would otherwise be scraped as a parameter with the value 7. Medicines are handled
    // separately, by parseMedications(), and only ever as drafts the user must confirm.
    if(/^(tab|tabs|tablet|cap|caps|capsule|syp|syrup|inj|injection|susp|drops?|oint|cream|spray|inhaler|sachet)\b\.?\s/i.test(line))continue;
    if(/\d\s*(?:mg|mcg|µg|ml|iu)\b/i.test(line) && /(once|twice|thrice|daily|\bod\b|\bbd\b|\btds\b|\bqid\b|\bsos\b|\bhs\b|after\s*(meals?|food)|before\s*(meals?|food)|\d\s*-\s*\d\s*-\s*\d)/i.test(line))continue;
    // Parasite/organism-positive findings ("Trophozoites of Pl. falciparum seen
    // (Index: 0.2%, 9040 parasites/ ul of blood)") carry embedded numbers (a
    // parasite index, a count) that the generic numeric extractor below would
    // otherwise seize on as "the value" -- producing a metric like "0.2%,
    // status: normal" for what is actually a positive malaria smear. This is a
    // patient-safety issue, not just noise: intercept and force-flag it BEFORE
    // any numeric parsing runs, regardless of what digits happen to be on the line.
    if(!consumed.has(i) && PARASITE_POSITIVE_RE.test(line)){
      const pkey='qual:parasite_smear';   // one flag per report, not per matching line
      if(!seen.has(pkey)){
        seen.add(pkey);
        metrics.push({
          key:pkey,name:'Parasites on Smear',canonicalName:'Parasites on Smear',group:'blood',
          value:'Positive (organism seen)',unit:'',min:null,max:null,
          normal_range:'None seen',refFromReport:false,known:true,status:'high',
          srcLine:line.slice(0,180),srcIndex:i
        });
      }
      continue;
    }
    // A qualitative FINDING line ("Platelet On Smear: Adequate", "WBC Morphology:
    // As Above", "Red Cell Morphology: Hypochromic Microcytic") carries no numeric
    // result at all. Left unchecked, it still fuzzy-matches a test name below (e.g.
    // "Platelet" inside "Platelet On Smear"), finds no value on its own line, and
    // falls into the forward multi-line scan a few lines down -- which then glues on
    // and searches SUBSEQUENT lines for any number, stealing an unrelated later
    // row's result (this is exactly how an HbA1c value several lines later got
    // mislabeled as this line's test). No genuine result row lacks digits entirely,
    // so a line with zero digits can never be one and must never anchor that scan.
    if(!/\d/.test(line))continue;
    // Skip prose / section titles (long lines, or headings with no measurement on them).
    const wordCount=(line.match(/[A-Za-z]{2,}/g)||[]).length;
    const hasMeasure=/\d\s*(?:g\/|mg|gm|ng|pg|pmol|nmol|umol|u\/|miu|uiu|mmol|ug|iu|%|fL|sec|mil|cell|10\s*\^|\/u?l|\/m[lL]|mm\/hr)/i.test(line)||/\d\s*[-–]\s*\d/.test(line)||/[<>]\s*=?\s*\d/.test(line);
    if(wordCount>=9 && !hasMeasure)continue;   // prose, not a result row
    if(/electrophoresis|examination|profile|panel|\bmini\b|chemical|capillary|routine exam/i.test(line)&&!hasMeasure)continue;
    if(/\b(?:indicative|suggestive|associated|consistent)\s+(?:of|with)\b|\bindicates?\b/i.test(line))continue;

    // A few PDF encodings lose the comparison glyph in "Normal: > 90" and
    // expose it as "Normal: - 90". The measured value is still unambiguous;
    // keep it and fall back to the analyte library rather than reversing it.
    const brokenNormalLimit=/^(.*?)\s+(-?\d+(?:\.\d+)?)\s+Normal\s*:\s*[-–—]\s*(\d+(?:\.\d+)?)\s*$/i.exec(line);
    if(brokenNormalLimit){
      const normalStd=matchTest(brokenNormalLimit[1]);
      if(normalStd&&!seen.has(normalStd.key)){
        const value=parseFloat(brokenNormalLimit[2]);
        const ov=rangeForProfile(normalStd.key,P.sex,P.age);
        const min=ov?ov.min:normalStd.min,max=ov?ov.max:normalStd.max;
        seen.add(normalStd.key);
        metrics.push({key:normalStd.key,name:cleanLabel(brokenNormalLimit[1])||normalStd.name,canonicalName:normalStd.name,
          group:normalStd.group||'other',value,unit:normalStd.unit||'',min,max,
          normal_range:(isFinite(max)?`${min} - ${max}`:`> ${min}`)+(normalStd.unit?` ${normalStd.unit}`:''),
          refFromReport:false,rangeNote:ov?ov.note:'general adult range',known:true,status:statusFor(value,min,max),
          srcLine:line.slice(0,180),srcIndex:i});
        continue;
      }
    }

    // Microscopy rows often express both the observed count and reference as
    // intervals ("Pus Cells 2-3 0-5"). Preserve the printed result while using
    // its upper bound for conservative status/trend calculations.
    const intervalRow=/^(.*?)\s+(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(line);
    if(intervalRow){
      let intervalStd=matchTest(intervalRow[1]);
      const nearby=lines.slice(Math.max(0,i-12),i+1).join(' ');
      const intervalLabel=normName(intervalRow[1]);
      if(/urine/i.test(nearby)){
        if(/^pus cells?$/.test(intervalLabel))intervalStd=std_('urine pus cells');
        else if(/^epithelial cells?$/.test(intervalLabel))intervalStd=std_('urine epithelial cells');
        else if(/^(?:red blood cells?(?: rbc)?|rbc)$/.test(intervalLabel))intervalStd=std_('urine rbc');
      }
      if(intervalStd&&!seen.has(intervalStd.key)){
        let unit=intervalStd.unit||'';
        for(let k=i+1;k<=Math.min(lines.length-1,i+2);k++){
          if(/\d/.test(lines[k]))break;
          const u=lines[k].match(/\/(?:hpf|lpf|cu\.?mm)|cells?\/(?:cu\.?mm|cumm|[uµ]?[lL])/i);
          if(u){unit=u[0];break;}
        }
        const resultLow=parseFloat(intervalRow[2]),resultHigh=parseFloat(intervalRow[3]);
        const refLow=parseFloat(intervalRow[4]),refHigh=parseFloat(intervalRow[5]);
        seen.add(intervalStd.key);
        metrics.push({key:intervalStd.key,name:cleanLabel(intervalRow[1])||intervalStd.name,canonicalName:intervalStd.name,
          group:intervalStd.group||'other',value:resultHigh,valueText:`${resultLow}-${resultHigh}`,unit,min:refLow,max:refHigh,
          normal_range:`${refLow} - ${refHigh}${unit?` ${unit}`:''}`,refFromReport:true,rangeNote:'from this report',known:true,
          status:(resultLow>refHigh?'high':resultHigh<refLow?'low':'normal'),srcLine:line.slice(0,180),srcIndex:i});
        continue;
      }
    }

    // Locate the VALUE: a number that is the measurement, not part of the name and
    // not part of the reference range. Strategy: find the name by locating where the
    // reference range / unit block begins, take the number just before it (if any).
    // First, isolate the reference-range span so we never mistake it for the value.
    // Prefer a two-sided reference interval wherever it appears. A comparator
    // before it is often the RESULT itself ("TSH <0.0083  0.35-4.94"), not the
    // reference range. Only fall back to a comparator when no interval exists.
    const trailingLimit=!/\bnormal\s*:/i.test(line)?/\s[-–—]\d+(?:\.\d+)?\s*$/.exec(line):null;
    const intervalMatch=trailingLimit?null:/-?\d+(?:\.\d+)?\s*[-–—]\s*-?\d+(?:\.\d+)?/.exec(line);
    const comparisons=[...line.matchAll(/(?:<=|>=|=<|=>|<|>|≤|≥)\s*-?\d+(?:\.\d+)?(?![\d.])/g)];
    const rangeMatch=trailingLimit||intervalMatch||(comparisons.length>1?comparisons[1]:comparisons[0]);
    const rangeStart=rangeMatch?rangeMatch.index:line.length;
    // Candidate value = last standalone number BEFORE the range span (skips name-digits
    // like Alpha 2 because those are followed by more name text, not a unit/range/end).
    let valStart=-1, valEnd=-1;
    const preRange=line.slice(0,rangeStart);
    // value = a number followed by (whitespace then) a unit token or end-of-string.
    // Unit token may itself start with a digit (e.g. "10^3/ul"), so allow that.
    // value = number followed by its unit, by end-of-line, or by a "--" no-range placeholder
    const vRe=/(?:^|[\sHLA:])(-?\d+(?:\.\d+)?)(?=\s+(?:10\s*(?:\^|[³⁶⁹])|[a-zµ%\/])|\s*(?:<=|>=|=<|=>|<|>|≤|≥)|\s*[-–—]{0,3}\s*$)/gi;
    let vm, lastS=-1,lastE=-1, unitS=-1,unitE=-1;
    while((vm=vRe.exec(preRange))){
      const s0=vm.index+vm[0].indexOf(vm[1]), e0=s0+vm[1].length;
      const after=preRange.slice(e0);
      // A result is the number directly followed by its UNIT. Prefer the first such
      // number, so we never pick a stray figure out of a ref-range caption like
      // "Follicular Phase: 3.5".
      if(unitS<0 && /^\s+(10\s*\^|[a-zµ%\/])/.test(after)){unitS=s0;unitE=e0}
      lastS=s0; lastE=e0;
    }
    // Tiered-reference rows (e.g. "Total Cholesterol Desirable: Less than 200 / Borderline
    // High: 200-239 / High: >239") put the real value on a LATER ": value unit" line.
    // Any number found here without a unit anchor (unitS<0) is a threshold, not the result.
    // Clearing lastS forces the forward scan to run, where colonValue() finds the real value.
    // Guard: when the value sits BEFORE the tier text on the same line (e.g.
    // "245 mg/dL Desirable: <200 …"), unitS>=0 is already set and we keep it untouched.
    if(TIER_WORDS_RE.test(line.slice(Math.max(0,line.search(/\d/))))&&unitS<0){
      const tierPos=line.search(TIER_WORDS_RE);
      const hasMeasuredValue=lastS>=0&&lastS<tierPos&&!!matchTest(line.slice(0,lastS));
      if(!hasMeasuredValue){lastS=-1;lastE=-1;}
    }
    if(unitS>=0){valStart=unitS;valEnd=unitE} else {valStart=lastS;valEnd=lastE}
    if(currentBeforePrevious){
      const columns=/^(.+?)\s+([<>]?\s*-?\d+(?:\.\d+)?)\s+([<>]?\s*-?\d+(?:\.\d+)?)(?=\s|$)/.exec(preRange);
      if(columns&&matchTest(columns[1])){
        valStart=columns[1].length+columns[0].slice(columns[1].length).indexOf(columns[2]);
        valEnd=valStart+columns[2].length;
      }
    }
    // A censored/limit result can legitimately have no unit on the same line.
    // Accept it only when it is the first numeric token after a recognizable
    // label; this does not confuse trailing reference captions such as
    // "Deficient: <20" with the measured value.
    const cmpResult=/^(.*?)(<=|>=|=<|=>|<|>|≤|≥)\s*(-?\d+(?:\.\d+)?)(?=\s|$)/.exec(preRange);
    if(cmpResult && matchTest(cmpResult[1]) && !/\d/.test(cmpResult[1])){
      valStart=cmpResult.index+cmpResult[0].lastIndexOf(cmpResult[3]);
      valEnd=valStart+cmpResult[3].length;
    }
    const numPos=valStart>=0?valStart:-1;
    const qualifier=numPos>=0?((line.slice(Math.max(0,numPos-4),numPos).match(/(<=|>=|=<|=>|<|>|≤|≥)\s*$/)||[])[1]||''):'';
    // Name = text before the value if the value is on this line, else the whole line.
    const namePart=numPos>0?line.slice(0,numPos):(rangeMatch?line.slice(0,rangeStart):line);
    let std=matchTest(namePart);
    let labelForDisplay=namePart;
    // A test name can wrap across lines, sometimes with a method note in between:
    //   "Bilirubin-"  /  "(Calculated)"  /  "   Indirect   1.10   mg/dL   0.1-1.0"
    // Look back a couple of lines (skipping method annotations) and retry the match.
    if(!std && numPos>0){
      for(let k=i-1;k>=Math.max(0,i-3);k--){
        const prev=lines[k];
        if(consumed.has(k)||!prev)continue;
        if(METHOD_RE.test(prev)||/^\([^)]*\)$/.test(prev))continue;   // skip "(Calculated)"
        if(/\d/.test(prev))break;
        if((prev.match(/[A-Za-z]{2,}/g)||[]).length>4)break;
        const joined=prev.replace(/[-–]\s*$/,'-')+' '+namePart;
        const s2=matchTest(joined);
        if(s2){ std=s2; labelForDisplay=joined; consumed.add(k); }
        break;
      }
    }

    // Unknown-metric capture is a LAB feature. Non-lab documents (invoices, receipts,
    // prescriptions, optical rx) are full of "label: number" pairs that are not clinical
    // and must not be surfaced as parameters.
    const looksLikeLabDoc=/reference (range|interval)|biological reference|observed value|test\s+result|specimen|collection date/i.test(text)
      || (metrics.length>=1);
    // --- Unknown-but-real parameters -------------------------------------------------
    // A lab report row is a row whether or not the marker is in our library. Rows like
    // "Control (MNPT) 11.2 sec", "Ratio 1.19", "Index 84.21 %" are genuine reported
    // values; dropping them silently loses data. If the row is structurally a result
    // (a label + a value on the SAME line) we keep it, with no high/low judgement,
    // because we have no reference range we can trust for it.
    if(!std && numPos>0){
      const lbl=cleanLabel(namePart);
      const words=(lbl.match(/[A-Za-z]{2,}/g)||[]).length;
      const looksLikeLabel=lbl.length>=2 && lbl.length<=45 && words>=1 && words<=5 && /^[A-Za-z(]/.test(lbl)
        && !/\b(is|are|was|were|may|can|from|than|the|of|and|with|for|greater|less|note|page|total bilirubin|patient|name|age|sex|gender|referred|regd?\.?\s*no|vid\s*no|pid\s*no|reported\s*on|collected\s*on|received\s*on|registered\s*on|study\s*date|dr\.?\b|mr|mrs|ms|miss|shri|smt|hospital|address|tel|phone|contact)\b/i.test(lbl)
        // reference-range captions are not parameters:
        // "Follicular Phase: 114-332 | Ovulation", "Normal Population : 0.8 - 1.2",
        // "Standard Therapy: 2.0-3.0", "Increased risk for Diabetes: 5.7-6.4"
        && !/\b(phase|trimester|ovulation|luteal|follicular|postmenopausal|post menopausal|menopausal|population|therapy|normal|high|low|borderline|optimal|desirable|diabetes|increased|decreased|uncontrolled|indicate|risk|pregnant|women|adults?|children|male|female|range|interval|method|caution|remark)\b/i.test(lbl);
      // NOTE: the word-units need \b, but "%" must NOT (there is no word boundary
      // after a percent sign), which previously made "Index 84.21 %" fail this test.
      const hasUnitOrRange=!!rangeMatch
        || /\d\s*%/.test(line)
        || /\d\s*(?:[a-zµ]{1,8}\s*\/[a-zµ.0-9]{1,8}|(?:sec|fL|pg|mg|ng|ug|gm|mmol|ratio|mIU|uIU|IU)\b)/i.test(line);
      // Some reported parameters are legitimately unitless with a "--" range
      // (PT "Ratio 1.19 --"). Accept those too, as long as nothing else follows.
      const tail=line.slice(valEnd).trim();
      const unitlessRow=!hasUnitOrRange && (tail===''||/^[-–—]{1,3}$/.test(tail));
      // Don't re-report an analyte we already captured under its proper name.
      // Serum-electrophoresis reports print the fractions twice (g/dL in the table,
      // % on the graph page), so "Beta 1" here is the same analyte as the
      // "Beta 1 Globulin" we already have. Keep the one with a real reference range.
      const ln=lbl.toLowerCase().trim();
      // Prefix match only: "Beta 1" is the same analyte as "Beta 1 Globulin", but the
      // PT panel's "Ratio" is NOT the same thing as "Albumin / Globulin Ratio", so a
      // plain substring test would wrongly swallow it.
      const dupOfKnown=metrics.some(mm=>{
        const kn=String(mm.canonicalName||mm.name).toLowerCase().trim();
        const rn=String(mm.name).toLowerCase().trim();
        return (kn.startsWith(ln+' ')||rn.startsWith(ln+' ')||kn===ln||rn===ln);
      });
      if(dupOfKnown)continue;
      if(!looksLikeLabDoc)continue;   // no unknown-scrape outside lab docs
      if(looksLikeLabel && (hasUnitOrRange||unitlessRow)){
        const ukey='x:'+lbl.toLowerCase().replace(/[^a-z0-9]+/g,'_');
        if(!seen.has(ukey)){
          std={key:ukey,name:lbl,group:'other',min:null,max:null,unit:'',unknown:true};
        } else continue;
      }
    }
    if(!std||seen.has(std.key))continue;

    // Assemble the data tail: same-line remainder + following non-name lines
    // until we hit a value, the next known test, a stop line, or a small budget.
    // If the value sits on this line, start there; otherwise start at the range/unit span.
    let data=numPos>=0?line.slice(numPos):(rangeMatch?line.slice(rangeStart):'');
    let val=numPos>=0?parseFloat(line.substr(valStart,valEnd-valStart)):null;
    let rangeTxt=data;
    // CRITICAL FIX: many real reports print "NAME <range> : <value> <unit>" all on
    // ONE line — the value comes AFTER the range, not before it (numPos<0 in that
    // case). Previously the code went straight into the "scan following lines"
    // loop below WITHOUT ever trying to read the value that's already sitting in
    // `data` (the current line's own tail, e.g. ": 5.05 x10^6/cmm"). That loop's
    // first action is to glue the NEXT line on and mark it `consumed` — so on a
    // report using this layout, every single row's line got permanently consumed
    // by the row before it, silently deleting the next marker every time (this is
    // how R.B.C. Count, MCV, MCHC, MPV, SGPT, Total Proteins, Globulin, BUN, eGFR
    // and more all vanished from a real report while their neighbours "worked").
    // Try the value that's already on THIS line first, before ever touching
    // another line.
    // Try colonValue first: it finds ": VALUE" with a standalone colon, which is exactly
    // the pattern for tiered-reference rows ("Total Cholesterol … : 261.0 mg/dl").
    // extractValue is the fallback for ordinary "NAME RANGE VALUE UNIT" layouts.
    if(val==null && data) val=colonValue(data)??extractValue(data);
    let j=i+1, budget=6;
    while(val==null && j<lines.length && budget-->0){
      const nx=lines[j];
      if(STOP_RE.test(nx))break;
      if(METHOD_RE.test(nx)){j++;continue}                 // skip method annotation
      // If the next line is itself a named test that carries its OWN value
      // (e.g. a bare section heading "HbA1C" followed by the real row
      // "HBA1C# 5.5 % Normal:4.0-5.6"), abandon this anchor and let that line
      // be parsed on its own. Otherwise we'd glue the name in and read a digit
      // out of the name itself ("HBA1C" -> 1).
      const nxRange=/(-?\d+(?:\.\d+)?\s*[-–]\s*-?\d+(?:\.\d+)?|[<>]\s*=?\s*\d+(?:\.\d+)?)/.exec(nx);
      const nxPre=nx.slice(0,nxRange?nxRange.index:nx.length);
      const nxHasValue=/(?:^|[\sHLA])(-?\d+(?:\.\d+)?)(?=\s+(?:10\s*\^|[a-zµ%\/])|\s*$)/i.test(nxPre);
      const nxNumPos=nx.search(/[<>]?\s*-?\d/);
      const nxName=nxNumPos>0?nx.slice(0,nxNumPos):nx;
      if(nxHasValue && matchTest(nxPre)){ val=null; break; }
      data+=' '+nx; rangeTxt+=' '+nx;
      // A qualitative tiered-reference block spans several lines ("Desirable:
      // Less than 200" / "Borderline High: 200-239" / "High: More than 239" /
      // colonValue takes priority: once a ": VALUE" line is absorbed into data,
      // it reliably returns the correct result while ignoring threshold numbers
      // like "Desirable: 200" or "Borderline High: 200-239" that extractValue
      // would incorrectly return first.
      val=colonValue(data)??extractValue(data);
      consumed.add(j);
      j++;
    }
    if(val==null)continue;
    // Reference range: prefer the report's own printed range. Parsed BEFORE the
    // plausibility check below, so that check can prefer it too -- a value can
    // be entirely consistent with the report's own stated range while still
    // falling outside a library-default-based ceiling, when the report happens
    // to use a different unit scale than the library assumes (e.g. a raw
    // cells/cmm count vs. the library's 10^3/uL default for the same marker).
    // Collect adjacent interpretation tiers even when the value was already on
    // the current line. This prevents a single "Deficient: <20" fragment from
    // being mistaken for the whole normal range when "Insufficient: 20-30" and
    // "Sufficient: 30-100" follow on later baselines.
    if(TIER_WORDS_RE.test(rangeTxt)){
      for(let k=i+1,b=4;k<lines.length&&b-->0;k++){
        if(STOP_RE.test(lines[k]))break;
        if(/\d/.test(lines[k])&&matchTest(lines[k]))break;
        rangeTxt+=' '+lines[k];
      }
    }
    const refSource=rangeMatch?line.slice(rangeStart):rangeTxt;
    const ref=parseRefRange(TIER_WORDS_RE.test(rangeTxt)?rangeTxt:refSource);
    // A multi-line discriminant/classifier block ("Beta Thalassemia trait: < 14"
    // / "Iron deficiency anaemia: >= 14") often prints across SEVERAL pdf rows.
    // Once val resolves above (usually from the first of those rows, since it
    // already carries the number), the scan loop stops there and never sees the
    // rest of the block -- so classifier detection alone would only ever see one
    // labelled segment and never recognize the pattern. Peek a further few lines
    // purely to enrich the text used for classifier detection; this never touches
    // `val`, never marks lines consumed, and only widens what detectClassifier sees.
    let classifierScanTxt=rangeTxt;
    const classifierEligible=/\b(index|ratio|score)\b/i.test(`${labelForDisplay} ${std.name||''}`);
    let classifier=classifierEligible?detectClassifier(classifierScanTxt,val):null;
    // Stop the INSTANT a valid 2-segment classifier is found -- not after a
    // fixed number of lines. A fixed budget over-consumes past the real second
    // segment into the NEXT metric's own row (confirmed: it swallowed a whole
    // neighbouring "Sehgal Index" block once and produced a garbled label).
    if(classifierEligible&&!classifier){
      let k=j,budget2=4;
      while(!classifier&&budget2-->0&&k<lines.length){
        const nx=lines[k];
        if(STOP_RE.test(nx)||matchTest(nx))break;
        classifierScanTxt+=' '+nx;
        classifier=detectClassifier(classifierScanTxt,val);
        k++;
      }
    }
    // Plausibility guard. Registration numbers, lab IDs and phone numbers are long
    // integers; no lab result has 8+ digits, and none sits orders of magnitude beyond
    // its own reference range. Reject rather than show a nonsense value.
    const digits=String(Math.trunc(Math.abs(val))).length;
    if(digits>7)continue;
    const ceilingBasis=(ref&&isFinite(ref.max)&&ref.max>0)?ref.max:(isFinite(std.max)&&std.max>0?std.max:null);
    const ceiling=ceilingBasis?ceilingBasis*1000:1e7;
    if(Math.abs(val)>ceiling)continue;

    // Precedence: report's own printed range > sex/age override > generic default.
    const ov=ref?null:rangeForProfile(std.key,P.sex,P.age);
    const min=ref?ref.min:(ov?ov.min:std.min), max=ref?ref.max:(ov?ov.max:std.max);
    const rangeNote=ref?'from this report':(ov?ov.note:'general adult range');
    if(std.unknown){
      // We do not know a trustworthy reference range for this marker, so we report the
      // value faithfully and make NO high/low claim. Guessing here would be worse than
      // saying nothing.
      let um0=rangeTxt.match(/[uµμ]g\/d[lL]|g\/d[lL]|mg\/d[lL]|mg\/L|gm\/d[lL]|ng\/m[lL]|pg\/m[lL]|[uµμ]?IU\/m[lL]|mmol\/L|U\/L|%|\bfL\b|\bpg\b|\bsec\b|\bratio\b|\/(?:hpf|lpf|mm[³3])/i);
      if(!um0){
        for(let k=i+1;k<=Math.min(lines.length-1,i+2);k++){
          if(/\d/.test(lines[k])||STOP_RE.test(lines[k]))break;
          um0=lines[k].match(/[uµμ]g\/d[lL]|g\/d[lL]|mg\/d[lL]|mg\/L|gm\/d[lL]|ng\/m[lL]|pg\/m[lL]|[uµμ]?IU\/m[lL]|mmol\/L|U\/L|%|\bfL\b|\bpg\b|\bsec\b|\bratio\b|\/(?:hpf|lpf|mm[³3])/i);
          if(um0)break;
        }
      }
      const u0=um0?um0[0]:'';
      if(!isFinite(val))continue;
      if(String(Math.trunc(Math.abs(val))).length>7)continue;
      seen.add(std.key);
      if(classifier){
        metrics.push({
          key:std.key, name:std.name, canonicalName:std.name, group:'other',
          value:val, qualifier, unit:u0, min:null, max:null,
          normal_range:classifierScanTxt.replace(/\s+/g,' ').trim().slice(0,140),
          classifierLabel:classifier.label,
          refFromReport:false, known:false, status:'classifier',
          srcLine:line.slice(0,180), srcIndex:i
        });
        continue;
      }
      metrics.push({
        key:std.key, name:std.name, canonicalName:std.name, group:'other',
        value:val, qualifier, unit:u0, min:(ref?ref.min:null), max:(ref?ref.max:null),
        normal_range:ref?((isFinite(ref.max)?`${ref.min} - ${ref.max}`:`> ${ref.min}`)+(u0?` ${u0}`:'')):'Not stated on the report',
        refFromReport:!!ref, known:false,
        status:ref?statusForQualified(val,ref.min,ref.max,qualifier):'unknown',
        srcLine:line.slice(0,180), srcIndex:i
      });
      continue;
    }
    // Unit: keep report's if recognizable, else library default.
    const unitPattern=/m[lL]\/min\/1[.,]73\s*m[²2]|[uµμ]g\/d[lL]|g\/d[lL]|g\/[lL]\b|mg\/d[lL]|mg\/L|gm\/d[lL]|ng\/m[lL]|pg\/m[lL]|ng\/d[lL]|[uµμ]?iu\/m[lL]|mmol\/L|10\^?\d\/[uµμ]?[lL]|U\/L|mil\/cu\.?mm|cells?\/(?:cu\.?mm|cumm|[uµμ]?[lL])|\/(?:hpf|lpf|mm[³3])|mm\/hr|%|\bfL\b|\bpg\b|\bsec\b|\bratio\b/i;
    let um=rangeTxt.match(unitPattern);
    // Unit/method text is often placed on the next PDF baseline. Peek without
    // consuming it, and never cross into a numeric result row.
    if(!um){
      for(let k=i+1;k<=Math.min(lines.length-1,i+2);k++){
        if(/\d/.test(lines[k])||STOP_RE.test(lines[k]))break;
        um=lines[k].match(unitPattern);
        if(um)break;
      }
    }
    const unitOut=um?um[0]:std.unit;
    const unitCompatible=!!ref||comparableUnit(um&&um[0],std.unit);
    const safeMin=unitCompatible?min:null,safeMax=unitCompatible?max:null;

    seen.add(std.key);
    const phased=!!std.phased;   // range varies with cycle phase / menopausal status
    metrics.push(classifier?{
      key:std.key,
      name:(numPos>0?cleanLabel(labelForDisplay):'')||std.name,
      canonicalName:std.name,
      group:std.group||'other',
      value:val, qualifier, unit:unitOut, min:null, max:null,
      normal_range:classifierScanTxt.replace(/\s+/g,' ').trim().slice(0,140),
      classifierLabel:classifier.label,
      refFromReport:false, known:true, status:'classifier',
      srcLine:line.slice(0,180), srcIndex:i
    }:{
      key:std.key,
      // Display exactly what the report calls it (e.g. "PT(INR) Value", not "INR").
      // The canonical key still drives trends, so the same marker still lines up
      // across labs even when they word it differently.
      name:(numPos>0?cleanLabel(labelForDisplay):'')||std.name,
      canonicalName:std.name,
      group:std.group||'other',
      value:val, qualifier, unit:unitOut, min:safeMin, max:safeMax,
      normal_range:unitCompatible?((isFinite(max)?`${min} - ${max}`:`> ${min}`)+(unitOut?` ${unitOut}`:'')+(phased?' (varies by cycle phase)':'')):'Not stated for this unit',
      refFromReport:!!ref, rangeNote:unitCompatible?rangeNote:'unit differs from library range', phased, known:true, status:unitCompatible?statusForQualified(val,min,max,qualifier):'unknown',
      // PROVENANCE: the exact text this number was read from. Lets the user check us.
      srcLine:line.slice(0,180), srcIndex:i
    });
  }
  // Qualitative findings pass — captures non-numeric clinical observations like
  // "Red Cell Morphology Hypochromic Microcytic :" and "Platelet On Smear Adequate :"
  // that the main loop skips entirely because they have no digits.
  // They ride the existing status:'unknown' / isFinite() guarded render path safely.
  parseQualitativeFindings(lines,metrics,seen);
  parseBloodPressure(String(text||''),metrics,seen);
  // Parsing uses decimal points internally, but provenance must show the
  // punctuation actually printed on the source page.
  for(const m of metrics){
    if(!m.srcLine||!m.srcLine.includes('.'))continue;
    const original=rawLines.find(raw=>raw.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim().replace(/(\d),(\d{1,2})(?!\d)/g,'$1.$2').startsWith(m.srcLine));
    if(original)m.srcLine=original.replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim().slice(0,180);
  }
  return metrics;
}
// Captures non-numeric clinical findings (morphology, adequacy notes) that the main
// loop skips. Format on Indian CBC reports: "TEST_NAME FINDING_TEXT :" (trailing colon).
// Scans prefix lengths from SHORTEST to LONGEST so "Red Cell Morphology" (3 words) is
// preferred over "Red Cell Morphology Hypochromic" (4 words, also a fuzzy-match hit).
function parseQualitativeFindings(lines,metrics,seen){
  const QUAL_OUTCOMES = /^(reactive|non\s*reactive|non-reactive|positive|negative|present|absent|detected|not\s*detected|weakly\s*reactive|weakly\s*positive|no\s*growth|growth|normal|abnormal|nil|none\s*seen|rare|few|moderate|many|trace|small|large|clear|hazy|cloudy|turbid|pale\s+yellow|straw(?:\s+yellow)?|yellow|amber|colourless|colorless)\b/i;
  for(const line of lines){
    if(/\d/.test(line))continue;                           // numeric rows: main loop's job
    const t=line.trim();
    if(t.length<5||t.length>120)continue;
    if(STOP_RE.test(t)||HEADER_RE.test(t))continue;
    if(/^(abnormalities|done on|method|interpretation|note\b|remark|caution|end of|cbc done|test done)/i.test(t))continue;
    // Strip trailing colon — it's just the PDF table's result-column separator
    const clean=t.replace(/\s*:\s*$/,'').trim();
    if(!clean||clean.length<5)continue;
    const words=clean.split(/\s+/);
    if(words.length<2)continue;   // need at least one test word + one finding word

    let std=null, findingPart='', nameWords=0, qualKey='', isKnownOutcome=false;
    for(let w=1;w<words.length;w++){
      const prefix=words.slice(0,w).join(' ');
      // Strip leading separator punctuation (":", "-") left over from splitting
      // on whitespace, e.g. "Morphology : Normal" -> suffix word 0 is ":" --
      // without this the outcome regex (anchored with ^) never matches, and the
      // code previously fell through to using this raw, colon-prefixed suffix.
      const suffix=words.slice(w).join(' ').replace(/^[:\-\s]+/,'');
      if(!suffix||suffix.length<2)continue;
      if(/\d/.test(suffix))continue;                        // finding must be text-only
      if(/^(section|test|result|unit|reference|range|report|dr\.|end)/i.test(suffix))continue;
      if(/^(smear|morphology|on\s+smear|serum|count|cell|blood|urine|plasma|specimen)\b/i.test(suffix))continue;

      const match = suffix.trim().match(QUAL_OUTCOMES);
      // A real qualitative OUTCOME WORD must be present — this is the only valid
      // trigger. Previously `matchTest(prefix)` alone (a known test NAME with no
      // recognizable outcome following it) could also trigger a capture, which
      // let a section heading like "INFLUENZA A & B SCREENING (SWINE FLU)" get
      // swallowed as if "& B SCREENING (SWINE FLU)" were Influenza A's result.
      // `std` is now only used to improve the display name/group, never as an
      // independent trigger.
      if(!match)continue;
      // Guard Rail: "Reactive Protein" is part of C-Reactive Protein's test name, NOT a qualitative finding!
      if(/^\s*reactive\s+protein/i.test(suffix.trim())) continue;

      const qk='qual:'+prefix.toLowerCase().replace(/[^a-z0-9]+/g,'_');
      if(seen.has(qk))break;                              // already captured this finding

      std=matchTest(prefix);
      // Qualitative extraction must still be anchored to a known clinical
      // analyte. Otherwise ordinary prose such as "...conditions. Low urea..."
      // can be split into a plausible-looking label plus an outcome word.
      if(!std)continue;
      const prefixWords=(prefix.match(/[A-Za-z]{2,}/g)||[]).length;
      if(prefixWords>5||/\b(is|are|was|were|may|can|from|than|the|of|and|with|for|diagnose|monitor|conditions?|levels?)\b/i.test(prefix))continue;
      findingPart=match[0];
      nameWords=w;
      qualKey=qk;
      isKnownOutcome=true;
      break;
    }
    if(!findingPart)continue;
    seen.add(qualKey);

    const resolvedName = cleanLabel(words.slice(0,nameWords).join(' ')) || (std ? std.name : words.slice(0,nameWords).join(' '));
    const status = (function(f){
      const v = String(f).toLowerCase().trim();
      if(/^(reactive|positive|present|detected|abnormal|weakly reactive|weakly positive|reactive\s*\(positive\)|growth|trace|small|large|few|moderate|many|hazy|cloudy|turbid)\b/i.test(v)) return 'high';
      if(/^(non reactive|non-reactive|negative|absent|not detected|nil|normal|no\s*growth|none\s*seen|clear|pale yellow|straw(?: yellow)?|yellow|amber|colourless|colorless)\b/i.test(v)) return 'normal';
      return 'unknown';
    })(findingPart);

    metrics.push({
      key:qualKey,
      name:resolvedName,
      canonicalName:std?std.name:resolvedName,
      group:std?std.group:'other',
      value:findingPart,   // qualitative string
      unit:'', min:null, max:null, normal_range:std&&std.key==='urine colour'?'Pale yellow / yellow':(isKnownOutcome ? (status === 'high' ? 'Non Reactive / Negative' : 'Negative') : ''),
      refFromReport:false, known:!!std, status:status,
      srcLine:line.slice(0,180), srcIndex:-1
    });
  }
}

export {STANDARD_RANGES,rangeForProfile,std_,matchTest,parseRefRange,statusFor,statusForQualified,normalizedUnit,comparableUnit,parseReportText};
