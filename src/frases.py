"""Banc de frases de l'entrenador del coll.

To: exigent però proper a tota la pujada; diu el nom de tant en tant i paraulotes sense manies.

Genera data/frases.json:  python3 src/frases.py

Etiquetes:
  cat    categoria (inici, entrada, fase, punt, gap, tend, diag, fc, queden, caminar, aturat,
         represa, final, reflexio, baixada, motiva, sistema, num)
  fase   1-8 (frases lligades a una fase concreta)
  grup   ini (fases 1-3, to proper) · mur (fases 4-6, transició a exigent) · fi (fases 7-8, exigent)
  estat  valor dins la categoria (p. ex. gap=davant, diag=conservador, queden=500)
  niv    intensitat de la veu: 1 tranquil · 2 ferm · 3 a fons
"""
import json, pathlib

FASES = {1: "Arrencada", 2: "Tram de ritme", 3: "Respir", 4: "Entrada al mur",
         5: "El mur", 6: "Replà", 7: "Quilòmetre dur", 8: "Coronar"}
NIV_FASE = {1: 1, 2: 1, 3: 1, 4: 2, 5: 3, 6: 2, 7: 3, 8: 3}
NIV_GRUP = {"ini": 1, "mur": 2, "fi": 3}

B = []  # (cat, tags, text)
def add(cat, texts, **tags):
    for t in texts:
        B.append((cat, dict(tags), t))

# ---------------------------------------------------------------- inici
add("inici", [
    "Som-hi. Comença el coll: tres quilòmetres i mig i gairebé tres-cents metres de desnivell. Paciència al principi.",
    "Comencem. Avui la clau és no gastar ara el que necessitaràs al mur.",
    "Rellotge en marxa. Entra a la pujada amb calma, que és llarga.",
    "Bé, Àlex, ja hi som. Primers metres tranquils: ritme de pujada, no de cursa.",
    "Arrenca la pujada. Recorda: el coll es guanya a partir del quilòmetre dos, no ara.",
    "Comença el ball. Troba el teu ritme, i que sigui un ritme de veritat.",
    "Vinga, a pujar. Els primers quatre-cents metres, suaus i constants.",
    "Som al peu del coll. Avui anem a buscar el teu millor temps, però amb cap.",
    "Pujada en marxa. Espatlles relaxades, passes curtes, i que el ritme surti sol.",
    "Comencem. Si surts massa fort ara, ho pagaràs al mur. Ja ho saps.",
    "Endavant. Un sol objectiu: arribar al mur amb forces.",
    "Ja estem. Tu corre, que jo et vigilo. I no te'n passaré ni una.",
], grup="ini", niv=1)

# ---------------------------------------------------------------- entrada a cada fase
add("entrada", [
    "Primer tram: quatre-cents metres a prop del vuit per cent. No és el moment de demostrar res.",
    "Arrencada. Pendent seriós des del principi: escurça la passa.",
    "Aquest primer tram enganya. Puja a ritme, no a orgull.",
    "Fase u: entra en calor pujant. Que les pulsacions pugin a poc a poc.",
], fase=1)
add("entrada", [
    "Tram de ritme. Vuit-cents metres al cinc i mig per cent: aquí es troba la velocitat de creuer.",
    "Ara suavitza una mica. Aprofita per allargar lleugerament la passa i agafar ritme.",
    "Comença el tram de ritme. Constància, que aquí es guanyen segons sense patir.",
    "Pendent més amable. No t'adormis: ritme sostingut fins al respir.",
    "Fase dos. Aquí pots córrer de debò, però sense passar-te de voltes.",
    "Tram de ritme: si vas bé de cames, és el lloc per arrencar uns segons.",
], fase=2)
add("entrada", [
    "Arriba el respir. Quatre-cents metres gairebé plans: recupera sense parar de córrer.",
    "Respir. Deixa baixar pulsacions, però mantén la cadència.",
    "Ara gairebé pla. Aprofita-ho per recuperar, que després ve el mur.",
    "Fase tres, el respir. Braços fluixos, que el cor es calmi.",
    "Respira, Àlex. Aquest tram és per carregar piles.",
    "Pla. No el malgastis: aquí recuperes, però també pots arrencar segons fàcils.",
], fase=3)
add("entrada", [
    "S'acaba el respir. Entrada al mur: dos-cents metres a prop del deu per cent.",
    "Ara torna a picar. Passes curtes i braços actius.",
    "Entrada al mur. Prepara't, que el que ve és el tram més dret.",
    "Comença a pujar fort. Mentalitza't: ara toca treballar.",
    "Fase quatre. Aquí el cos es queixa. No l'escoltis gaire.",
    "Entrem en zona seriosa. Mirada endavant i amunt.",
], fase=4)
add("entrada", [
    "El mur. Dos-cents setanta metres al quinze per cent. Passes curtes i amunt.",
    "Aquí és, collons. El mur. No es negocia.",
    "Mur! Cadència alta, passes petites, braços que empenyin.",
    "Ja hi ets, al mur. Ara no pensis, hòstia: puja.",
    "Quinze per cent. Inclina't endavant des dels turmells i tira amunt.",
    "El tram més dret. Si toca patir, es pateix. Amunt, collons.",
], fase=5)
add("entrada", [
    "Replà. Cent cinquanta metres per refer-te, però sense aturar-te.",
    "Mur superat. Aprofita el replà per respirar i tornar a allargar.",
    "Replà: recupera en moviment. Encara queda un quilòmetre dur.",
    "Bé, has passat el mur. Ara refés-te sense perdre ritme.",
    "Fase sis. Respira fons tres vegades i prepara't per al quilòmetre dur.",
    "Això és un replà, no un descans. Mantén les cames vives.",
], fase=6)
add("entrada", [
    "Comença el quilòmetre dur. Mil metres al dotze per cent. Aquí es decideix tot.",
    "Quilòmetre dur. Al principi hi ha una rampa del divuit per cent: passes curtes.",
    "Ara el tram llarg. Divideix-lo: d'aquí a cent metres, i després cent més.",
    "Fase set. Aquí és on es guanyen o es perden els segons de debò.",
    "Quilòmetre dur. Cap, cor i collons: tot a pujar.",
    "Ara ve el que entrenes. Mil metres de pujada de veritat.",
], fase=7)
add("entrada", [
    "Últim tram! El pendent afluixa: ara és el moment de buidar-ho tot.",
    "Coronant. Cent setanta metres més suaus. Accelera!",
    "Ja s'aplana. Allarga la passa i porta-ho fins a dalt.",
    "Fase vuit. Últims metres: res guardat a la butxaca.",
    "Corona, Àlex! Això ja és gairebé pla. A fons!",
    "Ja hi ets. Últim esforç fins al cim.",
], fase=8)

# ---------------------------------------------------------------- frases de farciment dins de cada fase
add("fase", [
    "Passes curtes i lleugeres. Que no et costi.",
    "Espatlles avall i relaxades.",
    "Respira amb la panxa, no amb el pit.",
    "Troba un ritme que puguis aguantar vint-i-cinc minuts.",
    "Encara és d'hora. Paciència, però sense adormir-te.",
    "Mira cinc metres endavant, no als peus.",
    "Si et sents molt bé, perfecte: guarda-ho.",
    "Braços al costat del cos, de davant cap enrere.",
    "El que estalviïs aquí, ho tindràs al mur.",
    "Bon començament. Ara, que no decaigui.",
], fase=1)
add("fase", [
    "Busca una cadència regular, com un metrònom.",
    "Aquí la passa pot ser una mica més llarga.",
    "Constant. Cada metre igual que l'anterior.",
    "Respira en ritme: dues passes inspirar, dues expirar.",
    "Molt bé. Aquest és el teu ritme de creuer.",
    "No t'adormis, que en aquest tram és fàcil perdre segons.",
    "Relaxa la cara i les mans. Tot l'esforç, a les cames.",
    "Bon tram. Mantén-lo fins al respir.",
    "Corre alt, amb el maluc endavant.",
    "Encara queda molt coll. Ritme intel·ligent.",
], fase=2)
add("fase", [
    "Recupera, però sense afluixar del tot.",
    "Respira profund. Omple els pulmons.",
    "Deixa anar els braços un moment i torna a posar-los.",
    "Aquí les pulsacions han de baixar una mica.",
    "Pensa en el mur, però amb calma: estàs preparat.",
    "Pla vol dir recuperar, no passejar.",
    "Passa normal, cadència viva.",
    "Carregant piles. Però corrent, eh, no passejant.",
    "Agafa aire. El que ve demana oxigen.",
    "Aprofita: és l'últim tram fàcil d'avui.",
], fase=3)
add("fase", [
    "Escurça la passa ja, abans que el pendent t'hi obligui.",
    "Braços! Que t'ajudin a pujar.",
    "Comença a costar. És normal. Endavant.",
    "Mirada amunt, pit obert.",
    "Prepara el cap: ara vénen els metres que importen.",
    "Ritme ferm. No et deixis anar.",
    "Aquí ja es nota. Bé: vol dir que treballes.",
    "Puja amb els turmells, no amb l'esquena.",
    "Va, va, va. Constància.",
    "No et pengis del pendent. Ataca'l.",
], fase=4)
add("fase", [
    "Passes petites i ràpides. Com si pugessis escales.",
    "Empeny amb els braços!",
    "No miris a dalt. Mira el metre següent.",
    "Aguanta. Això s'acaba, i tu no.",
    "Dur de collons, eh? Doncs amunt igualment.",
    "Cada passa és una passa menys.",
    "No negociïs amb el cansament. Puja.",
    "Cos endavant, cames a treballar.",
    "Això és el mur, Àlex. I tu el puges.",
    "Collons, que dret. Però tu ets més dur.",
    "Respira fort i segueix.",
    "Ni se t'acudeixi aturar-te ara, me cago en tot.",
], fase=5)
add("fase", [
    "Respira. Recupera en marxa.",
    "Allarga una mica la passa i deixa que les cames es descarreguin.",
    "Molt bé. El mur ja és història.",
    "Aprofita aquests metres: després no n'hi haurà.",
    "Torna a posar ordre: respiració, braços, cadència.",
    "Ja has fet el més dret. Ara, el més llarg.",
    "No t'hi recreïs. Cames vives.",
    "Bé, bé. Ara cap al quilòmetre dur.",
    "Treu-te la tensió de les espatlles.",
    "Recupera, però el rellotge no s'atura.",
], fase=6)
add("fase", [
    "Passes curtes a la rampa. Ja s'acabarà.",
    "D'aquí al revolt següent. Només això.",
    "No pensis en el cim. Pensa en els cent metres següents.",
    "Això és el que entrenes per a l'oposició. Demostra-ho.",
    "Braços i cadència. Que la passa no s'arrossegui.",
    "Dur no vol dir lent. Mantén el ritme.",
    "Cos endavant, mirada al terra de davant.",
    "Ara és quan els altres afluixen. Tu no.",
    "Sí que cansa. I què, hòstia? Amunt.",
    "Cada metre que puges aquí és un segon que guanyes a dalt.",
    "Hòstia, que dur. Va, que tu pots amb això.",
    "Constància. No et cal anar més ràpid, et cal no afluixar.",
    "Respira fort i empeny.",
    "Això ja ho has fet abans. Ho tornaràs a fer.",
    "Cames de ferro, Àlex. Amunt.",
], fase=7)
add("fase", [
    "Allarga la passa! Ja és pla.",
    "Ara accelera. Tot el que quedi, fora.",
    "Ja el veus. A fons!",
    "Buida el dipòsit, collons!",
    "No t'aturis abans d'hora. Fins al cim!",
    "Esprint! Va, va, va!",
    "Ja hi ets, collons! Amunt!",
    "Res a la butxaca. Tot ara.",
    "Braços ràpids, cames ràpides.",
    "Que se senti el final!",
], fase=8)

# ---------------------------------------------------------------- punts clau del recorregut
add("punt", [
    "Rampa del divuit per cent! Passes curtes, curtíssimes!",
    "Aquest és el tros més dret de tot el coll. Aguanta vint segons!",
    "La puta rampa! Cos endavant i amunt!",
    "Divuit per cent. Això passa ràpid si no t'atures.",
], estat="rampa", fase=7)
add("punt", [
    "Meitat del quilòmetre dur. Ja en queda menys del que has fet.",
    "Mig quilòmetre dur fet. L'altra meitat, igual de ferm.",
    "Ja ets a la meitat del tram llarg. Ara, a acabar-lo.",
], estat="mig_km_dur", fase=7)

# ---------------------------------------------------------------- comentari de la diferència amb el rècord (va després del número)
GAP = {
 "ini": {
  "molt_davant": [
    "Molt per davant tan d'hora. Compte, que el mur cobra interessos.",
    "Massa ràpid per ser el principi. Afluixa una mica.",
    "Vas fortíssim. Si les cames no ho confirmen, frena ara que encara hi ets a temps.",
    "Bona sensació, però el coll és llarg. No te'l mengis de cop.",
    "Molt de marge ja. Guarda'l, no el gastis tot ara."],
  "davant": [
    "Bon marge. Mantén-lo, sense apretar més.",
    "Per davant i amb el mur lluny. Bé, però amb prudència.",
    "Molt bé. És un bon avantatge, a aquestes alçades.",
    "Vas bé. No cal guanyar més temps aquí.",
    "Bon inici. Ara, a conservar-lo."],
  "igual": [
    "Clavat al teu millor ritme. Perfecte per començar.",
    "Exactament on toca. Segueix així.",
    "Igualat. El que passi a partir del mur ho decidirà.",
    "Bon control. Ni massa ni massa poc.",
    "Al teu ritme de rècord. Tranquil i constant."],
  "darrere": [
    "Una mica per darrere. Sense pànic, però no te'n refiïs: comença a apretar.",
    "Uns segons de retard. Res que no es pugui recuperar més amunt.",
    "Vas una mica conservador. Si et trobes bé, pots apretar una mica.",
    "Lleugerament lent. Ajusta el ritme sense fer cap bogeria.",
    "Poc retard. Les cames responen? Doncs ves-lo retallant a poc a poc."],
  "molt_darrere": [
    "Massa lent per ser el principi. Avui cal més ritme.",
    "Bastant retard. Encara hi ets a temps, però cal posar-s'hi ja.",
    "Vas massa còmode. Puja una marxa.",
    "Molts segons perduts ja. Prou de passejar, collons: a partir d'ara, apreta.",
    "Avui has sortit tou. Desperta, Àlex, hòstia!"]},
 "mur": {
  "molt_davant": [
    "Molt per davant al mur! Aguanta, que aquest marge val or.",
    "Gran avantatge. Si ara aguantes, avui fas rècord.",
    "Tens molt de marge. No el llencis: puja constant.",
    "Fantàstic. Ara només cal no rebentar.",
    "Molts segons a favor. Defensa'ls metre a metre."],
  "davant": [
    "Per davant. Aguanta el mur i el rècord és a prop.",
    "Bon avantatge. Ara toca defensar-lo.",
    "Vas per davant. Que aquests metres durs no te'l prenguin.",
    "Molt bé, segueixes guanyant al rellotge. No afluixis.",
    "Per davant al tram més dur. Això és molt bon senyal."],
  "igual": [
    "Igualat al mur. Aquí es decideix.",
    "Clavat. Qui afluixi ara, perd. I tu no afluixes.",
    "Exactament al teu millor temps. Ara cal donar una mica més.",
    "Empat amb el teu rècord. Guanya'l a partir d'aquí.",
    "Igualat. Un esforç petit ara són segons a dalt."],
  "darrere": [
    "Uns segons per darrere. El mur és el lloc per recuperar-los: apreta.",
    "Retard petit. Ara és quan es retalla. Va!",
    "Vas per darrere. Passes curtes i ràpides: guanya segons ara.",
    "Uns segons tard. No et rendeixis, que el quilòmetre dur encara ha de venir.",
    "Per darrere, però a tocar. Apreta, hòstia!"],
  "molt_darrere": [
    "Molt de retard. Oblida el rècord i fes el millor mur possible.",
    "Vas tard. Això no s'arregla amb paraules, s'arregla amb cames.",
    "Massa segons per darrere. Treu el que tinguis, collons.",
    "Avui costa. Doncs a pujar igualment, que també compta.",
    "Gran retard. Concentra't a guanyar temps al quilòmetre dur."]},
 "fi": {
  "molt_davant": [
    "Molt per davant! El rècord és teu si no t'atures.",
    "Gran marge! Porta'l fins a dalt.",
    "Rècord a la butxaca. Ara, a fer-lo encara més gran!",
    "Això és un dia gran. No afluixis fins al cim.",
    "Molts segons a favor. Remata-ho!"],
  "davant": [
    "Per davant! Aguanta i serà rècord.",
    "El rècord és a prop. No el deixis escapar!",
    "Vas guanyant. Ara, a tancar-ho.",
    "Bon avantatge. Defensa'l fins a dalt.",
    "Per davant, Àlex! Últim esforç!"],
  "igual": [
    "Igualat amb el rècord! Cada segon que guanyis ara és rècord.",
    "Clavat. Si apretes ara, és teu, collons!",
    "Empat tècnic. Guanya'l als últims metres!",
    "Exactament al teu rècord. Dona-ho tot!",
    "Tot igual. Qui té més ganes ara? Tu!"],
  "darrere": [
    "Per darrere, però a tocar. Encara hi ets a temps!",
    "Pocs segons. Si ho dones tot, el pots caçar!",
    "Va, hòstia, que el rècord encara és a l'abast!",
    "Retard petit. Apreta fins al final!",
    "Uns segons. Hòstia, que es pot! Amunt!"],
  "molt_darrere": [
    "Avui no serà rècord, però el final sí que pot ser bo. Amunt!",
    "Molt de retard. Acaba fort igualment: també és entrenament.",
    "Oblida el rellotge. Puja com si fos la prova de veritat.",
    "No serà el millor dia, però això no és excusa per afluixar, collons.",
    "Acaba-ho amb orgull. Fins a dalt a bon ritme."]},
}
for g, d in GAP.items():
    for estat, texts in d.items():
        add("gap", texts, grup=g, estat=estat)

# ---------------------------------------------------------------- tendència dels últims ~250 m
add("tend", ["Estàs retallant temps. Bé, sense forçar.",
             "Els darrers metres has anat millor. Mantén aquest ritme.",
             "Vas guanyant segons a poc a poc. Així.",
             "Bona tendència. Que l'emoció no t'acceleri."], grup="ini", estat="guanyant")
add("tend", ["Al mur estàs guanyant temps! Segueix!",
             "Retallant segons al tram dur. Això és força.",
             "Cada cop millor. No ho deixis ara.",
             "Estàs remuntant. Molt bé, Àlex!"], grup="mur", estat="guanyant")
add("tend", ["Estàs volant! Segueix així fins a dalt!",
             "Guanyant temps al final. Així es fa!",
             "Els últims metres són teus. Continua!",
             "Remuntada en marxa. Apreta!"], grup="fi", estat="guanyant")
add("tend", ["Has perdut uns segons en els últims metres. Revisa el ritme.",
             "T'estàs encantant, home. Torna al teu ritme.",
             "Vas baixant la velocitat sense adonar-te'n. Atenció.",
             "Perds una mica. Res greu, però corregeix-ho."], grup="ini", estat="perdent")
add("tend", ["Estàs perdent temps al mur. Passes curtes i ràpides!",
             "Se t'escapen segons. Braços, Àlex, braços!",
             "Afluixes. Ara no, me cago en la mar!",
             "Perds ritme. Concentra't en la cadència."], grup="mur", estat="perdent")
add("tend", ["Estàs perdent temps! No afluixis ara!",
             "Se t'escapa, hòstia! Treu el que et quedi!",
             "Ara no, collons! Amunt!",
             "Perds segons. Últim esforç, va!"], grup="fi", estat="perdent")
add("tend", ["Ritme molt regular. Així.",
             "Constant com un rellotge. Segueix.",
             "Estable. Això és control.",
             "Mantens el mateix ritme. Molt bé.",
             "Ni guanyes ni perds. Bon control.",
             "Regularitat perfecta. Endavant."], estat="estable")

# ---------------------------------------------------------------- diagnòstic combinant ritme i pulsacions (necessita FC)
DIAG = {
 "flipant": {
  "ini": ["Vas ràpid i amb les pulsacions altes. Aquest ritme no l'aguantaràs. Afluixa.",
          "Massa intensitat per ser el principi. Baixa una marxa ara.",
          "Pulsacions per sobre del teu millor dia. Això es paga al mur.",
          "T'estàs flipant, Àlex. Calma, collons, que el coll és llarg."],
  "mur": ["Pulsacions molt altes. Mantén, però no apretis més.",
          "Al límit. Controla, que encara queda el quilòmetre dur.",
          "Molt alt de cor. Passes curtes i respira, no forcis més.",
          "Estàs fent el mur a tope. Bé, però el que ve és llarg."],
  "fi":  ["Pulsacions a tope, però ja s'acaba. Aguanta!",
          "Vas al límit. Doncs ara és quan toca!",
          "Cor a mil. Queda poc, aguanta!",
          "Al límit, però és el final. Tot!"]},
 "dia_bo": {
  "ini": ["Més ràpid i amb les pulsacions controlades. Avui és un bon dia.",
          "Vas per davant sense pagar-ho de cor. Bon senyal.",
          "Bones cames avui. Aprofita-ho, però amb cap.",
          "Ritme bo i cor tranquil. Perfecte."],
  "mur": ["Per davant i amb el cor sota control. Dia de rècord.",
          "Les cames responen i el cor aguanta. Segueix!",
          "Avui estàs fort. Que es noti al mur!",
          "Molt bé: més ràpid i amb menys pulsacions. Això és forma."],
  "fi":  ["Tens cor de sobres. Buida-ho tot!",
          "Encara tens marge de pulsacions. A fons!",
          "Dia gran, Àlex. Remata'l!",
          "Cor tranquil al final? Doncs encara pots més!"]},
 "conservador": {
  "ini": ["Vas lent i amb pulsacions baixes. Tens marge: puja una mica el ritme.",
          "Massa conservador. El cor diu que pots anar més ràpid.",
          "Pulsacions baixes. Pots apretar sense por.",
          "Estàs guardant massa. Mou el cul, que tens marge."],
  "mur": ["Tens marge de pulsacions. Apreta al mur!",
          "Massa còmode, collons. Puja el ritme, que el cor ho aguanta.",
          "Prou de guardar, hòstia. És el moment de gastar.",
          "Pulsacions baixes per ser el mur. Pots més, Àlex!"],
  "fi":  ["Has guardat massa, collons! Ara buida-ho tot!",
          "Tens energia de sobres. A fons fins a dalt!",
          "Pulsacions baixes al final? Apreta, collons!",
          "No arribis a dalt amb forces. Gasta-les ara!"]},
 "dia_dur": {
  "ini": ["Avui costa: més lent i amb pulsacions altes. Gestiona, no forcis.",
          "Dia dur. Baixa una mica i guarda per al mur.",
          "El cos no respon com altres dies. Ritme prudent.",
          "Pulsacions altes i ritme lent. Respira i troba el teu punt."],
  "mur": ["Dia dur. Puja al teu ritme, sense rebentar.",
          "Avui costa. Passes curtes i constància.",
          "No és el teu millor dia, però el mur es puja igual.",
          "Gestiona l'esforç. El rècord no és avui; l'entrenament, sí."],
  "fi":  ["Dia dur, però queda poc. Aguanta!",
          "Costa de collons, però acaba-ho bé!",
          "Avui ha estat dur. Últim esforç igualment!",
          "Els dies dolents també fan cames. Fins a dalt!"]},
 "controlat": {
  "ini": ["Ritme i pulsacions com el teu millor dia. Perfecte.",
          "Tot sota control. Segueix així.",
          "Clavat de ritme i de cor. Molt bé.",
          "Control total. Així s'arriba bé al mur."],
  "mur": ["Mateix ritme i mateix cor que el dia del rècord. Ara, una mica més.",
          "Controlat. Si tens una marxa més, és el moment.",
          "Tot igual que el millor dia. Toca decidir: apretes?",
          "Bé de cor i de ritme. Aguanta i apreta."],
  "fi":  ["Igual que el rècord, de ritme i de cor. Dona-ho tot!",
          "Controlat fins aquí. Ara deixa anar el control!",
          "Tot a punt per rematar. Va!",
          "Ara sí, sense frens: a fons, hòstia!"]},
}
for estat, d in DIAG.items():
    for g, texts in d.items():
        add("diag", texts, grup=g, estat=estat)

# ---------------------------------------------------------------- pulsacions en valor absolut
add("fc", ["Pulsacions molt altes. Afluixa un moment i respira.",
           "Cor per sobre de cent vuitanta. Controla, que encara queda.",
           "Zona vermella. Respira fons i baixa una mica.",
           "Molt alt de pulsacions. Passes curtes i calma.",
           "Massa alt per a aquest moment. Baixa una mica el ritme."], estat="molt_alta", grup="ini")
add("fc", ["Zona vermella, però ja ho tens. Aguanta!",
           "Cor a tope. Últims metres, aguanta!",
           "Al límit. Només una mica més!"], estat="molt_alta", grup="fi")
add("fc", ["Pulsacions baixes per a aquest tram. Hi ha marge.",
           "El cor va tranquil. Pots anar més ràpid.",
           "Poques pulsacions. Desperta les cames."], estat="baixa")
add("fc", ["Bon control de pulsacions.",
           "Pulsacions estables. Molt bé.",
           "Cor regular. Segueix així.",
           "El cor respon bé. Endavant."], estat="be")

# ---------------------------------------------------------------- distància que queda
QUEDEN = {
 3000: ["Queden tres quilòmetres. Ja estàs dins.",
        "Tres quilòmetres per al cim. Ritme.",
        "Primer tram fet. Queden tres quilòmetres.",
        "Tres mil metres. Pas a pas."],
 2000: ["Queden dos quilòmetres. I els més durs.",
        "Dos quilòmetres per al final. Prepara't per al mur.",
        "Dos quilòmetres. Ara comença la pujada de veritat.",
        "Queden dos mil metres. Carrega piles ara."],
 1500: ["Queden mil cinc-cents metres. Ets enmig del mur. Amunt!",
        "Mil cinc-cents per al cim. Aguanta el mur!",
        "Quilòmetre i mig. Cada metre compta.",
        "Queda un quilòmetre i mig. Tu pots."],
 1000: ["Queda un quilòmetre. El més dur, però l'últim.",
        "Mil metres. Divideix-los en deu trams de cent.",
        "Un quilòmetre per al cim. Comença l'últim capítol.",
        "Últim quilòmetre, Àlex. Va per tu."],
 500:  ["Queden cinc-cents metres! Ja ho olores!",
        "Cinc-cents metres. Ara sí, comença a apretar.",
        "Mig quilòmetre! No et guardis res!",
        "Cinc-cents, collons! Això ja és teu!"],
 300:  ["Tres-cents metres! Apreta!",
        "Queden tres-cents. Tot el que tinguis!",
        "Tres-cents metres, collons! Amunt!",
        "Últims tres-cents. Sense mirar enrere!"],
 200:  ["Queden dos-cents metres. Ara no et guardes res!",
        "Dos-cents, hòstia! A fons!",
        "Dos-cents metres, Àlex! Esprint!",
        "Últims dos-cents! Va, va, va!"],
 100:  ["Cent metres! Tot!",
        "Últims cent! Buida't!",
        "Cent metres, hòstia! Ja hi ets!",
        "Cent! Fins a dalt de tot!"],
 50:   ["Cinquanta! Ja és teu!",
        "Últims metres! Ara!",
        "Ja hi ets! Fins al final!",
        "Cinquanta metres! A fons, collons!"],
}
for q, texts in QUEDEN.items():
    add("queden", texts, estat=q, niv=1 if q >= 2000 else 2 if q >= 1000 else 3)

# ---------------------------------------------------------------- caminar, aturar-se, reprendre
add("caminar", ["Si has de caminar, camina fort. Braços actius.",
                "Camina si cal, però en vint passes tornes a córrer.",
                "Caminant també es puja. Passa llarga i ferma.",
                "Caminar no és rendir-se. Torna a córrer quan puguis.",
                "Recupera caminant uns segons i tornem-hi.",
                "Caminant perds molt, hòstia. Torna a trotar, encara que sigui curt.",
                "Mans als genolls si cal, però amunt.",
                "Uns segons caminant i a córrer. Tu decideixes quan."], niv=2)
add("aturat", ["T'has aturat. Respira i torna-hi quan puguis.",
               "Aturat. El rellotge segueix comptant. Amunt!",
               "Un moment de pausa. Ara, a seguir.",
               "No et quedis aquí, Àlex. Pas a pas.",
               "Recupera deu segons i reprenem.",
               "Tornem-hi? Va, collons, que el cim no baixa sol."], niv=2)
add("represa", ["Això és. Tornem a córrer.",
                "Molt bé, de nou en marxa.",
                "Endavant una altra vegada.",
                "Així m'agrada. Amunt."], niv=2)

# ---------------------------------------------------------------- final al cim
add("final", ["Rècord! I de molt! Quina pujada, Àlex!",
              "Nou rècord, i amb marge! Avui has volat!",
              "Hòstia puta, quin rècord! I per molts segons!",
              "Rècord destrossat! Això és forma de veritat!"], estat="record_gran", niv=3)
add("final", ["Nou rècord! Ho has aconseguit!",
              "Rècord, collons! Pocs segons, però teus!",
              "Nou millor temps! Bona feina!",
              "Rècord, Àlex! Ben treballat!"], estat="record", niv=3)
add("final", ["Clavat al teu rècord! Per un pèl!",
              "Gairebé igual que el teu millor temps. Molt a prop!",
              "Empat amb el rècord. La propera cau segur."], estat="igual", niv=2)
add("final", ["Cim! A pocs segons del rècord. Bona pujada.",
              "Fet! No ha estat rècord, però hi has estat a prop.",
              "Coll superat. A uns segons del teu millor dia.",
              "Fet! Uns segons per darrere, però bona feina."], estat="lent", niv=2)
add("final", ["Cim! Avui no ha sortit el temps, però la pujada està feta.",
              "Fet. No ha estat el millor dia, i no passa res.",
              "Has arribat a dalt. Els dies durs també sumen.",
              "Coll pujat. Descansa, i la propera, millor."], estat="molt_lent", niv=1)
add("reflexio", ["Has acabat molt fort: tenies més marge del que has gastat. La propera, surt una mica més ràpid.",
                 "Has guardat massa al principi. Amb aquest final, el rècord era possible.",
                 "Final molt potent. Ara cal portar part d'aquesta energia al tram de ritme."], estat="marge", niv=1)
add("reflexio", ["Has sortit fort i ho has pagat al final. La propera, més paciència fins al mur.",
                 "Massa ràpid al principi. El quilòmetre dur t'ho ha cobrat.",
                 "Bona sortida, però t'ha faltat gasolina al final. Regula millor."], estat="buit", niv=1)
add("reflexio", ["Pujada molt ben repartida. Així es fa.",
                 "Ritme molt equilibrat de principi a final. De manual.",
                 "Bona gestió de l'esforç. Això és saber pujar."], estat="equilibrat", niv=1)
add("baixada", ["Ara baixa tranquil i recupera.",
                "Cim fet. Baixada suau, que les cames t'ho agrairan.",
                "Recupera. Beu aigua quan puguis.",
                "Gran feina avui. A baixar amb calma."], niv=1)

# ---------------------------------------------------------------- motivació genèrica
add("motiva", ["Estàs fent el que toca. Constància.",
               "Cada pujada et fa més fort.",
               "Gaudeix-ne. Aquest és el teu coll.",
               "Vas bé. Però vull més que bé.",
               "Un metre darrere l'altre.",
               "Corre fàcil. Que sembli fàcil.",
               "Avui sumes. Sempre sumes.",
               "Bona feina. I no t'hi acostumis, que ara ve el dur.",
               "Ritme, respiració i cap. Tot en ordre.",
               "Molt bé, Àlex.",
               "Això és base. Això és el que després marca la diferència.",
               "Paciència. El coll premia qui sap esperar.",
               "Bon pas. Endavant.",
               "Fluid. Així.",
               "Estàs on has de ser.",
               "Vas bé, però no et conformis.",
               "Còmode està bé. Massa còmode, no.",
               "Ritme ferm, cap fred."], grup="ini")
add("motiva", ["Ara es veu qui ha entrenat.",
               "Això és el que et farà passar les físiques.",
               "El dolor passa. El temps queda.",
               "Aguanta. Ets més fort que aquesta pujada.",
               "No et rendeixis ara, que és quan compta.",
               "Has vingut a pujar, no a passejar.",
               "Cada pujada dura és un període més a la navette.",
               "Pensa en el dia de la prova. Puja per això.",
               "Es fa dur perquè ho estàs fent bé.",
               "Amunt, Àlex! Amunt!",
               "Un pas més. I un altre.",
               "Collons, que bé que ho estàs fent.",
               "El mur no sap qui ets. Ensenya-li-ho.",
               "Això és caràcter, collons.",
               "Cap fort, cames fortes.",
               "Me cago en la pujada. Amunt igualment!",
               "Que li donin pel sac al cansament. Puja!",
               "Hòstia, Àlex, que això és el mur i tu ets més dur."], grup="mur")
add("motiva", ["Ja ho tens! No afluixis!",
               "Ara o mai!",
               "Tot el que has entrenat, ara!",
               "No hi ha demà. Hi ha ara!",
               "Va, que ja hi ets!",
               "Dona-ho tot, Àlex!",
               "Això és teu! Amunt!",
               "L'últim esforç és el que compta!",
               "Ni una passa fluixa, hòstia!",
               "Final! A fons!",
               "Hòstia, quina pujada que estàs fent!",
               "Que quedi tot aquí dalt!",
               "Remata-ho!",
               "Ara ets imparable!",
               "Fins al final, sense excuses de merda!",
               "Va, collons, va, va!",
               "Amunt, me cago en tot!",
               "Que no et guanyi aquesta puta pujada!",
               "Hòstia puta, apreta!",
               "Ara, collons, ara!"], grup="fi")

# ---------------------------------------------------------------- sistema
add("sistema", ["GPS connectat. Quan arribis a l'inici de la pujada, comencem."], estat="gps_ok", niv=1)
add("sistema", ["Encara no tinc bon senyal de GPS. Espera uns segons."], estat="gps_espera", niv=1)
add("sistema", ["He perdut el GPS. Tu segueix, que el recupero."], estat="gps_perdut", niv=1)
add("sistema", ["GPS recuperat."], estat="gps_recuperat", niv=1)
add("sistema", ["Pulsòmetre connectat."], estat="fc_ok", niv=1)
add("sistema", ["S'ha desconnectat el pulsòmetre. Ho torno a provar."], estat="fc_perdut", niv=1)
add("sistema", ["Pulsòmetre recuperat."], estat="fc_recuperat", niv=1)
add("sistema", ["Estàs fora de la ruta del coll."], estat="fora_ruta", niv=1)
add("sistema", ["Tornes a ser a la ruta. Seguim."], estat="ruta_ok", niv=1)
add("sistema", ["Ets a prop de l'inici de la pujada. Quan passis per la sortida, comença el compte."], estat="a_prop_inici", niv=1)
add("sistema", ["Preparat? La pujada comença d'aquí a uns metres."], estat="a_prop_inici", niv=1)
add("sistema", ["Prova de so. Si em sents per sobre de la música, tot funciona."], estat="prova_so", niv=1)

# ---------------------------------------------------------------- números (es diuen en lletres per tenir el gènere bé)
UNITS = ["", "un", "dos", "tres", "quatre", "cinc", "sis", "set", "vuit", "nou", "deu", "onze", "dotze",
         "tretze", "catorze", "quinze", "setze", "disset", "divuit", "dinou"]
TENS = {20: "vint", 30: "trenta", 40: "quaranta", 50: "cinquanta", 60: "seixanta", 70: "setanta",
        80: "vuitanta", 90: "noranta"}
def num(n, fem=False):
    def u(k):
        if fem and k == 1: return "una"
        if fem and k == 2: return "dues"
        return UNITS[k]
    if n == 0: return "zero"
    if n >= 100:
        r = n - 100
        return "cent" + ("" if r == 0 else " " + num(r, fem))
    if n < 20: return u(n)
    t, k = (n // 10) * 10, n % 10
    if k == 0: return TENS[t]
    return TENS[t] + ("-i-" if t == 20 else "-") + u(k)

def seg(n): return "un segon" if n == 1 else num(n) + " segons"
NUM = []
for n in range(1, 61):  NUM.append(("davant", n, f"Vas {seg(n)} per davant."))
for n in range(1, 91):  NUM.append(("darrere", n, f"Vas {seg(n)} per darrere."))
NUM.append(("igual", 0, "Vas clavat al teu rècord."))
for n in range(1, 91):  NUM.append(("record_per", n, f"Rècord per {seg(n)}."))
for n in range(1, 121): NUM.append(("a_del_record", n, f"A {seg(n)} del rècord."))
for m in range(18, 41): NUM.append(("minuts", m, f"Temps: {num(m)} minuts"))
for s in range(0, 60):  NUM.append(("isegons", s, "i un segon." if s == 1 else ("justos." if s == 0 else f"i {num(s)} segons.")))
for h in range(120, 200): NUM.append(("fc", h, f"{num(h, fem=True).capitalize()} pulsacions."))


# ---------------------------------------------------------------- valoració implícita
# Frases de categories "neutres" (fase, motiva) que diuen que vas bé o que t'estàs refiant.
# El motor només les pot dir si les dades ho confirmen (vegeu README, «Regles del motor»).
VALORA = {"positiu": ['Bon començament. Ara, que no decaigui.', 'Molt bé. Aquest és el teu ritme de creuer.', 'Bon tram. Mantén-lo fins al respir.', 'Molt bé. El mur ja és història.', 'Bé, bé. Ara cap al quilòmetre dur.', 'Estàs fent el que toca. Constància.', 'Vas bé. Però vull més que bé.', "Bona feina. I no t'hi acostumis, que ara ve el dur.", 'Molt bé, Àlex.', 'Bon pas. Endavant.', 'Fluid. Així.', 'Estàs on has de ser.', 'Ritme, respiració i cap. Tot en ordre.', 'Vas bé, però no et conformis.', 'Es fa dur perquè ho estàs fent bé.', 'Collons, que bé que ho estàs fent.', 'Ja ho tens! No afluixis!', 'Això és teu! Amunt!', 'Hòstia, quina pujada que estàs fent!', 'Ara ets imparable!'],
          "retret": ['Has vingut a pujar, no a passejar.', 'Còmode està bé. Massa còmode, no.']}

# ---------------------------------------------------------------- sortida
out, ids = [], {}
for cat, tags, text in B:
    k = cat
    ids[k] = ids.get(k, 0) + 1
    fase = tags.get("fase")
    grup = tags.get("grup") or ({1: "ini", 2: "ini", 3: "ini", 4: "mur", 5: "mur", 6: "mur", 7: "fi", 8: "fi"}[fase] if fase else None)
    niv = tags.get("niv") or (NIV_FASE[fase] if fase else NIV_GRUP.get(grup, 2))
    val = next((v for v, ts in VALORA.items() if text in ts), None)
    out.append({"id": f"{cat}_{ids[k]:03d}", "cat": cat, "fase": fase, "grup": grup,
                "estat": tags.get("estat"), "niv": niv, "text": text, **({"valora": val} if val else {})})
for kind, n, text in NUM:
    out.append({"id": f"num_{kind}_{n}", "cat": "num", "fase": None, "grup": None, "estat": kind,
                "n": n, "niv": 2, "text": text})

root = pathlib.Path(__file__).resolve().parent.parent
(root / "data/frases.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
hand = [o for o in out if o["cat"] != "num"]
print("frases escrites:", len(hand), "· numèriques:", len(out) - len(hand), "· total àudios:", len(out))
from collections import Counter
print(Counter(o["cat"] for o in hand))
