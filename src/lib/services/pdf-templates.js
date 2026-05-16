/* ============================================
   VNK Automatisation Inc. — Templates PDF v2
   Devis · Facture · Contrat de service

   Chaque document a une identité visuelle distincte :
   - DEVIS    : header bleu primaire  #1B4F8A
   - FACTURE  : header marine foncé   #0F2D52  + accent vert statut
   - CONTRAT  : header bicolore split prestataire / client

   INSTALLATION: npm install pdfkit
   USAGE: const { generateQuotePDF, generateInvoicePDF, generateContractPDF, autoGenerateContract } = require('./pdf-templates');
============================================ */

'use strict';
const PDFDocument = require('pdfkit');

// ─────────────────────────────────────────────
// I18N — traductions structure (FR/EN)
// Le contenu metier (titres, descriptions saisies) reste tel quel.
// ─────────────────────────────────────────────
const I18N = {
    fr: {
        // Communs
        document: 'Document confidentiel',
        generatedOn: 'Généré le',
        client: 'CLIENT',
        provider: 'PRESTATAIRE',
        name: 'Nom',
        company: 'Entreprise',
        email: 'Courriel',
        phone: 'Téléphone',
        city: 'Ville',
        signature: 'Signature',
        signedBy: 'Signé le',
        date: 'Date',
        // Devis
        quoteHeader: 'DEVIS',
        quoteDetails: 'DÉTAILS DU DEVIS',
        quoteNumber: 'Numéro',
        quoteDate: 'Date',
        quoteExpiry: "Valide jusqu'au",
        quoteExpiryDefault: '30 jours',
        quoteStatus: 'Statut',
        quoteStatusApproved: 'Approuvé',
        quoteStatusPending: "En attente d'approbation",
        quoteStatusApprovedShort: 'APPROUVÉ',
        quoteServicesDesc: 'Description des services',
        quoteServiceLines: 'Lignes de service',
        quoteTotal: 'TOTAL DU DEVIS',
        quotePaymentTerms: 'Conditions de paiement',
        quoteAcceptance: 'Acceptation et signature',
        quoteAcceptanceText: "En signant ci-dessous, le client reconnaît avoir lu, compris et accepté les termes et conditions du présent devis, et autorise VNK Automatisation Inc. à procéder aux travaux décrits.",
        quoteSigClient: 'SIGNATURE DU CLIENT',
        quoteSigDate: 'DATE DE SIGNATURE',
        quoteApproved: 'DEVIS APPROUVÉ ✓',
        quoteAcceptDate: "Date d'acceptation",
        quoteSigDateFmt: 'Date (JJ/MM/AAAA)',
        quoteCondFull: (amount) => `Paiement unique de ${amount} TTC dû à la signature du contrat.`,
        quoteCondDeposit: (pct, amount) => `Acompte de ${pct} % (${amount} TTC) dû à la signature du contrat.`,
        quoteCondBalance: (pct, amount) => `Solde de ${pct} % (${amount} TTC) dû à la livraison des travaux.`,
        quoteCondValid: (date) => `Devis valide 30 jours à compter du ${date}.`,
        quoteCondNotContract: "Ce devis ne constitue pas un contrat — un contrat de service sera émis après acceptation.",
        quoteCondCurrency: "Les prix sont en dollars canadiens (CAD) et excluent les taxes applicables.",
        // Facture
        invoiceHeader: 'FACTURE',
        invoiceDetails: 'DÉTAILS DE LA FACTURE',
        invoiceIssued: 'Date émission',
        invoiceDue: 'Date échéance',
        invoiceTotalLabel: 'TOTAL TTC',
        invoiceDescription: 'Description',
        invoicePaidOn: 'Date',
        invoicePayCash: 'Paiement comptant',
        invoicePayStripe: 'Paiement sécurisé via Stripe',
        invoicePaymentInfo: 'Informations de paiement',
        // Contrat
        contractHeader: 'CONTRAT DE SERVICES',
        contractAnnex: 'Annexe',
        contractAnnexDesc: 'Description',
        contractTariffs: 'Tarifs en vigueur',
        contractRatesNote: (date) => `Tarifs en vigueur au ${date}. Tous les prix sont en dollars canadiens (CAD), taxes en sus (TPS 5 % + TVQ 9,975 %).`,
        contractAuditType: "Type d'audit",
        contractRate: 'Tarif',
        contractDescription: 'Description',
        contractType: 'Type',
        contractLevel: 'Niveau',
        contractAvailability: 'Disponibilité',
        contractResponseTime: 'Délai de réponse',
        contractTakeoverTime: 'Délai prise en charge',
        contractPlan: 'Forfait',
        contractHoursIncluded: 'Heures incluses',
        contractMonthlyRate: 'Tarif mensuel',
        contractExample: 'Exemple',
        contractSpecificTerms: 'Conditions particulières',
        // Tableau services
        tableDescription: 'Description',
        tableQty: 'Qté',
        tableUnit: 'Unité',
        tableAmount: 'Montant HT',
        tableSubtotal: 'Sous-total HT',
        tableGst: 'TPS (5 %)',
        tableQst: 'TVQ (9,975 %)',
        tableTotal: 'TOTAL TTC',
        unitDefault: 'forfait',
        empty: '—',
    },
    en: {
        document: 'Confidential document',
        generatedOn: 'Generated on',
        client: 'CLIENT',
        provider: 'PROVIDER',
        name: 'Name',
        company: 'Company',
        email: 'Email',
        phone: 'Phone',
        city: 'City',
        signature: 'Signature',
        signedBy: 'Signed on',
        date: 'Date',
        quoteHeader: 'QUOTE',
        quoteDetails: 'QUOTE DETAILS',
        quoteNumber: 'Number',
        quoteDate: 'Date',
        quoteExpiry: 'Valid until',
        quoteExpiryDefault: '30 days',
        quoteStatus: 'Status',
        quoteStatusApproved: 'Approved',
        quoteStatusPending: 'Pending approval',
        quoteStatusApprovedShort: 'APPROVED',
        quoteServicesDesc: 'Description of services',
        quoteServiceLines: 'Service lines',
        quoteTotal: 'QUOTE TOTAL',
        quotePaymentTerms: 'Payment terms',
        quoteAcceptance: 'Acceptance and signature',
        quoteAcceptanceText: "By signing below, the client acknowledges having read, understood and accepted the terms and conditions of this quote, and authorizes VNK Automatisation Inc. to proceed with the described work.",
        quoteSigClient: 'CLIENT SIGNATURE',
        quoteSigDate: 'SIGNATURE DATE',
        quoteApproved: 'QUOTE APPROVED ✓',
        quoteAcceptDate: 'Acceptance date',
        quoteSigDateFmt: 'Date (DD/MM/YYYY)',
        quoteCondFull: (amount) => `Single payment of ${amount} (incl. tax) due upon contract signature.`,
        quoteCondDeposit: (pct, amount) => `Deposit of ${pct}% (${amount} incl. tax) due upon contract signature.`,
        quoteCondBalance: (pct, amount) => `Balance of ${pct}% (${amount} incl. tax) due upon delivery of work.`,
        quoteCondValid: (date) => `Quote valid 30 days from ${date}.`,
        quoteCondNotContract: 'This quote is not a contract — a service contract will be issued upon acceptance.',
        quoteCondCurrency: 'Prices are in Canadian dollars (CAD) and exclude applicable taxes.',
        invoiceHeader: 'INVOICE',
        invoiceDetails: 'INVOICE DETAILS',
        invoiceIssued: 'Issue date',
        invoiceDue: 'Due date',
        invoiceTotalLabel: 'TOTAL (incl. tax)',
        invoiceDescription: 'Description',
        invoicePaidOn: 'Date',
        invoicePayCash: 'Cash payment',
        invoicePayStripe: 'Secure payment via Stripe',
        invoicePaymentInfo: 'Payment information',
        contractHeader: 'SERVICE CONTRACT',
        contractAnnex: 'Annex',
        contractAnnexDesc: 'Description',
        contractTariffs: 'Current rates',
        contractRatesNote: (date) => `Rates in effect as of ${date}. All prices are in Canadian dollars (CAD), taxes extra (GST 5% + QST 9.975%).`,
        contractAuditType: 'Audit type',
        contractRate: 'Rate',
        contractDescription: 'Description',
        contractType: 'Type',
        contractLevel: 'Level',
        contractAvailability: 'Availability',
        contractResponseTime: 'Response time',
        contractTakeoverTime: 'Takeover time',
        contractPlan: 'Plan',
        contractHoursIncluded: 'Hours included',
        contractMonthlyRate: 'Monthly rate',
        contractExample: 'Example',
        contractSpecificTerms: 'Specific conditions',
        tableDescription: 'Description',
        tableQty: 'Qty',
        tableUnit: 'Unit',
        tableAmount: 'Amount (excl. tax)',
        tableSubtotal: 'Subtotal',
        tableGst: 'GST (5%)',
        tableQst: 'QST (9.975%)',
        tableTotal: 'TOTAL',
        unitDefault: 'package',
        empty: '—',
    },
};

function getDict(lang) {
    return I18N[lang === 'en' ? 'en' : 'fr'];
}

// ─────────────────────────────────────────────
// CONTENU CONTRAT (clauses + annexes) FR/EN
// ⚠️ Traduction EN à valider par un avocat avant utilisation officielle
// ─────────────────────────────────────────────
const CONTRACT_TEXT = {
    fr: {
        section1Title: '1.  Objet du contrat',
        section1Intro: 'Le présent contrat définit les modalités selon lesquelles VNK Automatisation Inc. (le « Prestataire ») fournit au Client des services professionnels en automatisation industrielle, incluant notamment :',
        section1Bullets: [
            'Support PLC à distance ou sur site (diagnostic, dépannage, optimisation)',
            'Audit technique, documentation et modernisation de systèmes automatisés',
            'Mise à disposition de ressources techniques spécialisées',
        ],
        section1Outro: 'Les modalités spécifiques de chaque mandat sont précisées dans un devis ou une annexe signée par les Parties.',
        section2Title: '2.  Mandat visé par ce contrat',
        section2QuoteRef: (num, amount) => `Référence devis : ${num}  —  Montant total : ${amount} (TTC)`,
        section2Fallback: "Services d'automatisation industrielle selon entente préalable.",
        section24Title: '33.  Signatures',
        section24Para: (date) => `Fait en deux exemplaires originaux. Les soussignés déclarent avoir lu, compris et accepté les termes du présent contrat daté du ${date}.`,
        annexesIntro: "Le présent contrat inclut les annexes suivantes, intégrées et faisant partie intégrante de l'entente :",
        annexesTable: [
            ['Annexe A', 'Accord de niveau de service (SLA)'],
            ['Annexe B', 'Contrat de support mensuel récurrent'],
            ['Annexe C', 'Grille tarifaire officielle VNK'],
            ['Annexe D', 'Mise à disposition de ressources techniques'],
        ],
        clauses: [
            ['3.  Documents contractuels',
                `Le présent contrat comprend, par ordre de priorité : (a) le présent contrat et ses annexes ; (b) le devis accepté par le Client ; (c) les bons de commande émis par le Client ; (d) toute entente écrite signée entre les Parties.`],
            ['4.  Rémunération et conditions de paiement',
                `Le Client s'engage à payer les montants prévus au devis. Un acompte de 50 % est exigible à la signature. Le solde est payable dans les 30 jours suivant l'émission de la facture finale. Tout retard entraîne des intérêts de 2 % par mois (24 % par an). Le Prestataire peut suspendre les services en cas de non-paiement. Les montants sont exclusifs de TPS et TVQ. Le Prestataire se réserve le droit de réviser ses tarifs annuellement moyennant un préavis écrit de 30 jours.`],
            ['5.  Frais et remboursements',
                `Le Client rembourse les frais raisonnables : déplacements (0,70 $/km), hébergement, repas lors d'interventions sur site, matériel ou licences nécessaires. Les acomptes ne sont pas remboursables sauf annulation imputable exclusivement au Prestataire. Toute annulation par le Client après début des travaux est facturée au prorata. Annulation tardive (moins de 5 jours ouvrables) : 50 % du montant prévu peut être facturé.`],
            ['6.  Obligations du client',
                `Le Client s'engage à : (a) fournir un accès sécurisé et fonctionnel aux systèmes et tous les documents techniques nécessaires ; (b) désigner un interlocuteur technique qualifié et disponible ; (c) informer le Prestataire de toute contrainte de sécurité et des fenêtres de maintenance ; (d) s'assurer que les systèmes sont accessibles et en état permettant l'intervention ; (e) respecter les normes de sécurité et les procédures internes. Tout retard imputable au Client entraîne des frais supplémentaires et un ajustement des délais.`],
            ["7.  Délais d'exécution",
                `Le Prestataire s'engage à respecter les délais du devis, sauf : (a) imprévus techniques non prévisibles à la signature ; (b) retards imputables au Client ; (c) cas de force majeure. En cas de dépassement du fait exclusif du Prestataire, le Client notifie par écrit et les parties s'entendent sur un nouveau calendrier avant tout recours.`],
            ['8.  Sécurité des interventions',
                `Les interventions sur systèmes PLC/SCADA/HMI présentent des risques inhérents. En conséquence : (a) Le Client est seul responsable de l'activation des systèmes de sécurité physiques (LOTO, arrêts d'urgence) avant et pendant toute intervention ; (b) les modifications de programme seront testées hors ligne puis en mode manuel avant mise en production ; (c) le Client doit avoir du personnel qualifié sur site lors d'interventions à distance sur des systèmes en production ; (d) pour les interventions sur site, le technicien se conformera aux règles internes du Client, à recevoir par écrit avant l'intervention ; (e) le Prestataire ne modifiera jamais les fonctions de sécurité homologuées (safety PLC, relais, arrêts d'urgence) sans autorisation écrite et documentation préalable.`],
            ['9.  Cybersécurité et accès distant',
                `L'accès aux systèmes s'effectue exclusivement via des canaux sécurisés (VPN, connexion chiffrée). Le Prestataire s'engage à : (a) n'utiliser les accès que pour les besoins stricts du mandat ; (b) protéger les identifiants ; (c) signaler immédiatement tout incident de sécurité détecté ; (d) notifier le Client de révoquer les accès dès la fin du mandat. Le Client est responsable de la segmentation réseau isolant ses systèmes industriels. Les pratiques applicables sont alignées sur la série ISA/IEC 62443 (édition courante, notamment 62443-4-1 pour le cycle de vie de développement sécurisé et 62443-4-2 pour les composants IACS) et, pour le système de gestion de la sécurité de l'information du Prestataire, sur ISO/IEC 27001.`],
            ['10.  Sauvegarde et intégrité des données',
                `Avant toute modification, le Prestataire procède à la sauvegarde complète des programmes PLC, HMI et SCADA. Une copie est remise au Client. En cas d'incident lors de l'intervention, le Prestataire s'engage à restaurer depuis cette sauvegarde. Le Client demeure responsable de maintenir ses propres sauvegardes indépendamment. Le Prestataire ne peut être tenu responsable des données préexistantes non sauvegardées par le Client.`],
            ['11.  Assurance',
                `Le Prestataire déclare maintenir une assurance responsabilité professionnelle adéquate couvrant ses activités. Une preuve d'assurance peut être fournie sur demande.`],
            ['12.  Sous-traitance',
                `Le Prestataire peut recourir à des sous-traitants qualifiés. Il demeure responsable de la qualité des services et du respect des obligations contractuelles.`],
            ['13.  Propriété intellectuelle et livrables',
                `Les programmes PLC, HMI, SCADA et toute documentation développés spécifiquement deviennent la propriété exclusive du Client après paiement intégral. Les méthodes, outils et savoir-faire génériques du Prestataire demeurent sa propriété exclusive. Le Prestataire peut référencer l'existence du mandat à des fins commerciales, sans divulguer d'informations confidentielles.`],
            ['14.  Confidentialité et protection des renseignements personnels',
                `Les Parties traitent comme strictement confidentiels tous les renseignements échangés (programmes PLC, schémas, procédés industriels, informations financières). Cette obligation survit à la fin du contrat pour cinq (5) ans. Un NDA distinct peut être signé sur demande pour les mandats à information sensible. Les renseignements personnels éventuellement collectés sont traités conformément à la Loi sur la protection des renseignements personnels dans le secteur privé du Québec (« Loi 25 ») et, lorsqu'applicable, à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE / PIPEDA, fédérale). Pour les renseignements visant des résidents de l'Espace économique européen, les Parties conviennent d'incorporer par renvoi les Clauses Contractuelles Types de la Commission européenne (Décision 2021/914) en annexe distincte au besoin. Les coordonnées professionnelles utilisées strictement dans le cadre du mandat ne constituent pas des renseignements personnels au sens de la LPRPDE.`],
            ['15.  Garantie et rectification',
                `Le Prestataire garantit la conformité des livrables pour 90 jours suivant la réception. Durant cette période, il corrige sans frais tout dysfonctionnement directement imputable à l'intervention. La garantie exclut : (a) modifications par le Client ou un tiers ; (b) usure matérielle ; (c) problèmes préexistants non signalés.`],
            ["16.  Rapport d'intervention",
                `À chaque fin de mandat, le Prestataire remet un rapport écrit détaillant : (a) les travaux réalisés et modifications effectuées ; (b) les tests et leurs résultats ; (c) l'état avant/après ; (d) les recommandations de maintenance ; (e) la liste des sauvegardes. Faute d'objection écrite du Client dans les 10 jours ouvrables, les travaux sont réputés acceptés.`],
            ['17.  Limitation de responsabilité',
                `La responsabilité totale du Prestataire est limitée au montant total facturé pour le mandat. Le Prestataire ne peut être tenu responsable : (a) des pertes d'exploitation, arrêts de production, manque à gagner ; (b) des dommages indirects ou consécutifs ; (c) des dommages résultant de modifications non autorisées après livraison ; (d) des défaillances matérielles préexistantes ; (e) des conséquences d'une utilisation non conforme. Cette limitation s'applique dans toute la mesure permise par le droit québécois.`],
            ['18.  Exclusion — systèmes de sécurité',
                `Le Prestataire ne peut être tenu responsable de dommages corporels, matériels ou environnementaux résultant de : (a) défaillance de systèmes de sécurité hors périmètre du mandat ; (b) activation/désactivation par le Client hors procédures convenues ; (c) utilisation dans des conditions différentes de celles du devis ; (d) manquement du Client aux règles de sécurité applicables (LSST, RSST, NFPA 70E, IEC 61508, ISO 13849). Le Client reconnaît que tout système PLC/SCADA/HMI contrôlant des équipements dangereux nécessite une validation complète avant remise en service.`],
            ['19.  Non-sollicitation',
                `Le Client s'engage à ne pas solliciter ni embaucher, directement ou indirectement, les ressources du Prestataire ayant été personnellement et substantiellement impliquées dans l'exécution du présent mandat, pendant la durée du contrat et pour douze (12) mois suivant sa fin. La présente clause est accessoire au contrat de services principal, limitée en portée (ressources directement impliquées au mandat), en durée (12 mois) et en territoire (juridictions où le Prestataire exerce), conformément à l'exception prévue au paragraphe 45(4) de la Loi sur la concurrence (Canada). En cas de non-respect, une indemnité équivalente à douze (12) mois de rémunération brute de la ressource concernée sera due, à titre de dommages-intérêts liquidés. La présente clause ne s'applique pas aux candidats répondant à une offre d'emploi publique non ciblée.`],
            ['20.  Non-exclusivité',
                `Le présent contrat n'accorde aucune exclusivité au Client. Le Prestataire demeure libre de fournir des services similaires à d'autres clients.`],
            ['21.  Résiliation',
                `Chaque Partie peut résilier avec un préavis écrit de 30 jours. Les travaux réalisés et frais engagés sont facturés au prorata. En cas de manquement grave non corrigé dans les 15 jours suivant une mise en demeure, la résiliation peut être immédiate. Le Prestataire ne quittera jamais un système en état instable ou dangereux ; une phase de stabilisation minimale sera complétée avant la fin des travaux.`],
            ['22.  Force majeure',
                `Les Parties incorporent par renvoi la « ICC Force Majeure Clause 2020 — Long Form » publiée par la Chambre de commerce internationale, qui couvre notamment : catastrophes naturelles, conflits armés, sanctions internationales, cyberattaques de tiers, pannes d'infrastructure Internet, pandémies, grèves générales, ruptures de chaîne d'approvisionnement (incluant semi-conducteurs et composants industriels critiques) et décisions gouvernementales. Aucune Partie ne sera tenue responsable d'un manquement causé par un tel événement. La partie affectée notifie l'autre dans les quarante-huit (48) heures et met tout en œuvre pour limiter l'impact. Si la situation dure plus de soixante (60) jours, chaque Partie peut résilier le contrat sans pénalité, sous réserve du paiement des travaux livrés.`],
            ['23.  Droit applicable et règlement des différends',
                `Le présent contrat est régi par les lois de la province de Québec et les lois fédérales du Canada applicables. En cas de différend, les parties tentent un règlement à l'amiable dans les trente (30) jours suivant la notification écrite. À défaut, et sauf disposition contraire ci-dessous, le différend est soumis à la compétence exclusive des tribunaux du district judiciaire de Québec. Pour les contrats avec un Client dont le siège est hors du Canada, les Parties peuvent convenir par écrit de soumettre le différend à un arbitrage final et obligatoire selon le Règlement d'arbitrage de la Chambre de commerce internationale (CCI), siège à Montréal ou Paris, en français ou en anglais, par un (1) arbitre unique pour les différends inférieurs à 250 000 CAD et trois (3) arbitres au-delà. Le présent contrat constitue l'intégralité de l'entente entre les Parties et remplace tout accord antérieur. Toute modification doit être faite par écrit et signée par les deux Parties. Si une clause est jugée invalide, les autres clauses demeurent en vigueur.`],
            ['24.  Signature électronique',
                `Les Parties reconnaissent que la signature du présent contrat par moyens électroniques (incluant signature manuscrite numérisée, signature de canevas, ou signature certifiée par horodatage RFC 3161) a la même valeur juridique qu'une signature manuscrite. Cette reconnaissance s'appuie sur l'article 2827 du Code civil du Québec, sur les articles 5 à 11 de la Loi concernant le cadre juridique des technologies de l'information (RLRQ c C-1.1) et sur la Partie 2 de la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) ainsi que le Règlement sur les signatures électroniques sécurisées (DORS/2005-30) au niveau fédéral. Les fichiers PDF signés et leurs métadonnées (IP, horodatage, agent utilisateur) constituent une preuve admissible.`],
            ['25.  Devise et risque de change',
                `Sauf mention contraire au devis, toutes les sommes sont libellées en dollars canadiens (CAD). Pour un Client facturé dans une autre devise, la conversion s'effectue au taux de référence de la Banque du Canada à la date d'émission de la facture. Le risque de change demeure à la charge du Client. Le Prestataire peut ajuster les montants futurs si le taux varie de plus de cinq pour cent (5 %) entre la date du devis et la date de facturation, moyennant un préavis écrit.`],
            ['26.  Contrôle des exportations et sanctions',
                `Le Client déclare et garantit qu'il n'est pas et ne sera pas, pendant la durée du contrat, désigné sur les listes de personnes ou entités sanctionnées en vertu de la Loi sur les mesures économiques spéciales (Canada), de la Loi sur les Nations Unies, de la Loi sur la justice pour les victimes de dirigeants étrangers corrompus, ni sur les listes de l'OFAC (États-Unis), de l'Union européenne, du Royaume-Uni ou de l'ONU. Le Client garantit également que les services fournis ne seront pas utilisés à des fins prohibées par la Loi sur les licences d'exportation et d'importation (Canada) ou tout régime équivalent. Le Prestataire peut suspendre ou résilier sans pénalité tout mandat dont l'exécution violerait un régime de sanctions applicable, sous réserve de paiement des travaux livrés.`],
            ['27.  Communications électroniques',
                `Les Parties consentent mutuellement à recevoir des communications électroniques (courriels, messages via le portail client, notifications) en lien avec le présent contrat et la relation d'affaires existante (RAE) qui en découle. Le Client consent à recevoir des messages électroniques commerciaux du Prestataire pour la durée du contrat et pendant les vingt-quatre (24) mois suivant sa fin, conformément à la Loi canadienne anti-pourriel (LCAP / CASL). Le Client peut retirer son consentement en tout temps via le mécanisme de désinscription présent dans chaque communication.`],
            ['28.  Politique de remboursement',
                `Le Client a droit à un remboursement intégral ou partiel dans les cas suivants : (a) annulation du mandat par le Prestataire avant tout début des travaux ; (b) incapacité du Prestataire à livrer les services pour des motifs qui lui sont exclusivement imputables, non corrigés dans les quinze (15) jours suivant une mise en demeure écrite ; (c) défaut de conformité majeur des livrables non rectifié dans le cadre de la garantie (clause 15). Aucun remboursement n'est dû en cas de : changement d'avis du Client après début des travaux, refus du Client de fournir les accès ou collaborations requises, force majeure (clause 22), ou utilisation non conforme. Le remboursement est versé dans un délai de trente (30) jours suivant l'accord écrit entre les Parties, par le même mode de paiement que la transaction d'origine. Les frais bancaires, frais Stripe non récupérables et frais de change sont déduits. Le solde des travaux effectivement livrés et accepté demeure facturable.`],
            ['29.  Procédure de gestion des différends',
                `Avant tout recours judiciaire ou arbitral (clause 23), les Parties s'engagent à suivre la procédure d'escalade suivante : (a) Niveau 1 — notification écrite détaillée par la partie réclamante au chargé de compte de l'autre partie, réponse attendue sous cinq (5) jours ouvrables ; (b) Niveau 2 — si non résolu, escalade au représentant désigné de chaque partie (pour le Prestataire : Yan Verone Kengne, Président), tentative de résolution sous quinze (15) jours ; (c) Niveau 3 — médiation par un tiers neutre désigné conjointement (Institut de médiation et d'arbitrage du Québec ou équivalent), sur trente (30) jours ; (d) Niveau 4 — recours selon clause 23. Les montants non contestés demeurent payables selon les échéances prévues. Les travaux non liés au différend continuent normalement. Tout délai dans cette procédure suspend les éventuels intérêts de retard sur les montants contestés.`],
            ['30.  Crédits de service (SLA)',
                `Si le Prestataire manque aux délais de réponse définis à l'Annexe A (SLA), le Client a droit à un crédit de service applicable sur la facture du mois en cours, selon le barème suivant : dépassement jusqu'à 25 % du délai cible = crédit de 5 % du forfait mensuel ; dépassement de 25 % à 100 % = crédit de 15 % ; dépassement de plus de 100 % = crédit de 25 %. Le crédit total mensuel est plafonné à cinquante pour cent (50 %) du forfait mensuel. Les crédits sont automatiquement appliqués sur la facture suivante et ne donnent pas droit à un remboursement monétaire. Les crédits ne s'appliquent pas en cas de force majeure, d'indisponibilité causée par le Client, ou pour les interventions hors forfait.`],
            ['31.  Réception, acceptation et rejet des livrables',
                `À la livraison de chaque mandat ou jalon, le Prestataire fournit le rapport d'intervention prévu à la clause 16. Le Client dispose de dix (10) jours ouvrables pour notifier par écrit toute non-conformité substantielle constatée. Le rejet doit identifier précisément l'élément non conforme et la spécification non respectée. Le Prestataire dispose alors d'un délai raisonnable (généralement quinze (15) jours ouvrables) pour rectifier sans frais supplémentaires. Après deux (2) tentatives de rectification infructueuses sur le même point, le Client peut : (a) accepter en l'état avec un crédit négocié ; (b) demander un remboursement partiel proportionnel à la portion non conforme (clause 28). Faute d'objection écrite dans les dix (10) jours ouvrables, les livrables sont réputés acceptés et la garantie de la clause 15 prend effet.`],
            ['32.  Oppositions de paiement et chargebacks',
                `Le Client s'engage à contacter le Prestataire avant toute initiation d'opposition de paiement (chargeback) auprès de sa banque, de Stripe ou de l'émetteur de sa carte, et à respecter d'abord la procédure de gestion des différends (clause 29). Toute opposition initiée sans tentative préalable de résolution amiable constitue un manquement au présent contrat. Si l'opposition est jugée non fondée par l'émetteur ou Stripe, les frais de traitement engagés par le Prestataire (incluant les frais de dossier de Stripe, soit 15 USD par opposition, plus le temps de défense au tarif horaire de l'Annexe C) sont facturés au Client. Le Prestataire conserve toutes les preuves de livraison et de communication nécessaires à la défense d'une opposition pendant au moins sept (7) ans, conformément aux exigences de conservation comptable canadiennes.`],
        ],
        annexA: {
            title: 'Annexe A — Accord de niveau de service (SLA)',
            intro: "La présente annexe définit les niveaux de service applicables aux prestations de support technique fournies par VNK Automatisation Inc. dans le cadre des services d'automatisation industrielle.",
            coverageTitle: 'Périmètre des services couverts',
            coverageItems: [
                'Support PLC, HMI et SCADA',
                'Diagnostic et dépannage à distance ou sur site',
                'Assistance technique lors de mises en service',
                'Support réseau industriel et cybersécurité de base',
            ],
            slaLevelsTitle: 'Niveaux de service et délais de réponse',
            slaLevelsHeaders: ['Niveau', 'Disponibilité', 'Délai de réponse', 'Délai prise en charge'],
            slaLevelsRows: [
                ['Standard', 'Lun–Ven, 8h–17h', '24 h ouvrables', '48 h'],
                ['Prioritaire', 'Lun–Ven, 8h–20h', '8 h ouvrables', '24 h'],
                ['Urgence', '24/7', '2 heures', 'Immédiat selon dispo'],
            ],
            classifTitle: 'Classification des incidents',
            classifHeaders: ['Niveau', 'Description', 'Exemple'],
            classifRows: [
                ['Critique', 'Arrêt complet de production', 'PLC hors service'],
                ['Majeur', 'Fonctionnement dégradé', 'Défaut réseau ou communication'],
                ['Mineur', 'Problème non bloquant', 'Ajustement paramétrique'],
            ],
            exclusionsTitle: 'Exclusions du SLA',
            exclusionsItems: [
                'Pannes matérielles non liées aux services fournis',
                'Modifications non autorisées par le Client ou un tiers',
                'Événements de force majeure',
                'Systèmes non couverts par le mandat en cours',
            ],
        },
        annexB: {
            title: 'Annexe B — Contrat de support mensuel récurrent',
            intro: "La présente annexe définit les modalités de support technique récurrent en automatisation industrielle. Le Client choisit l'un des forfaits ci-dessous selon ses besoins.",
            plansTitle: 'Forfaits mensuels disponibles',
            plansHeaders: ['Forfait', 'Heures incluses', 'Délai de réponse', 'Tarif mensuel'],
            plansRows: [
                ['Essentiel', '5 heures', '24 h ouvrables', '1 000 CAD'],
                ['Professionnel', '10 heures', '8 h ouvrables', '1 800 CAD'],
                ['Premium', '20 heures', '4 h ouvrables', '3 200 CAD'],
            ],
            plansNote: 'Les heures supplémentaires au-delà du forfait sont facturées selon la grille tarifaire officielle (Annexe C). Les heures non utilisées dans le mois ne sont pas reportées.',
            durationTitle: 'Durée et renouvellement',
            durationPara: "Durée initiale de 12 mois. Renouvellement automatique sauf avis écrit de résiliation 30 jours avant l'échéance. Facturation mensuelle payable dans un délai de 30 jours.",
            specialTitle: 'Conditions particulières',
            specialItems: [
                "Le forfait est activé dès réception de l'acompte du premier mois.",
                'Le niveau de service (délai de réponse) est garanti dans les limites du forfait choisi.',
                "Les interventions d'urgence hors forfait sont majorées de 25 % (voir Annexe C).",
                'Le Client peut changer de forfait avec un préavis écrit de 30 jours.',
            ],
        },
        annexC: {
            title: 'Annexe C — Grille tarifaire officielle VNK Automatisation Inc.',
            intro: (date) => `Tarifs en vigueur au ${date}. Tous les prix sont en dollars canadiens (CAD), taxes en sus (TPS 5 % + TVQ 9,975 %).`,
            techTitle: 'Services techniques',
            techHeaders: ['Service', 'Tarif'],
            techRows: [
                ['Support PLC à distance', '120 – 150 CAD / heure'],
                ['Intervention sur site', '140 – 180 CAD / heure'],
                ["Banque d'heures prépayée (10 h)", '1 100 CAD (économie de 400 CAD)'],
                ['Forfait mensuel standard', '1 200 CAD / mois'],
                ['Forfait mensuel prioritaire', '2 500 CAD / mois (réponse garantie)'],
            ],
            auditTitle: 'Audit technique',
            auditHeaders: ["Type d'audit", 'Tarif', 'Description'],
            auditRows: [
                ['Audit standard', '1 500 – 2 500 CAD', 'Système simple — 1 à 2 automates'],
                ['Audit complet', '2 500 – 4 000 CAD', 'Système complexe — multiples automates'],
            ],
            docTitle: 'Documentation industrielle',
            docHeaders: ['Type', 'Tarif', 'Description'],
            docRows: [
                ['Documentation de base', '800 – 2 000 CAD', 'Procédures opérateur et maintenance'],
                ['Documentation complète', '2 000 – 5 000 CAD', 'Tout inclus — code, procédures, schémas'],
            ],
            refacTitle: 'Refactorisation PLC',
            refacHeaders: ['Type', 'Tarif', 'Description'],
            refacRows: [
                ['Refactorisation partielle', '3 000 – 10 000 CAD', 'Modules ou sections ciblées'],
                ['Refactorisation complète', '10 000 – 25 000 CAD', 'Programme complet restructuré'],
                ['Nouvelle implémentation', '5 000 – 50 000 CAD', 'Réécriture complète ou nouveau projet'],
            ],
            extraTitle: 'Frais supplémentaires',
            extraHeaders: ['Type de frais', 'Tarif'],
            extraRows: [
                ['Déplacement', '0,70 CAD / km'],
                ['Temps de déplacement', '50 % du tarif horaire'],
                ["Intervention d'urgence", 'Majoration de 25 %'],
                ['Intervention hors heures ouvrables', 'Majoration de 50 %'],
            ],
        },
        annexD: {
            title: 'Annexe D — Mise à disposition de ressources techniques',
            intro: "La présente annexe encadre la fourniture de ressources techniques spécialisées par VNK Automatisation Inc. auprès du Client pour des mandats temporaires ou récurrents en automatisation industrielle.",
            typesTitle: 'Types de ressources disponibles',
            typesItems: [
                'Programmeurs PLC (Siemens, Rockwell, B&R, Schneider)',
                'Techniciens en automatisation industrielle',
                'Spécialistes HMI / SCADA (WinCC, FactoryTalk, Wonderware)',
                'Experts en réseaux industriels (Profinet, EtherNet/IP, Modbus)',
            ],
            ratesTitle: 'Tarification indicative',
            ratesHeaders: ['Profil', 'Tarif journalier (8 h)'],
            ratesRows: [
                ['Technicien en automatisation', '700 – 900 CAD / jour'],
                ['Programmeur PLC', '900 – 1 200 CAD / jour'],
                ['Expert senior', '1 200 – 1 600 CAD / jour'],
            ],
            ratesNote: "Les frais de déplacement, d'hébergement et autres dépenses autorisées sont facturés en sus selon la grille tarifaire (Annexe C).",
            modalitiesTitle: "Modalités d'intervention",
            modalitiesItems: [
                'Les ressources demeurent sous la responsabilité contractuelle et administrative du Prestataire.',
                'Le Client assure la supervision opérationnelle quotidienne des ressources mises à disposition.',
                "Le Client s'engage à fournir un environnement de travail conforme aux normes de santé et sécurité applicables.",
                'Facturation mensuelle ou selon les modalités du devis, payable dans les 30 jours.',
            ],
            nonSolicitTitle: 'Non-sollicitation',
            nonSolicitPara: "Le Client s'engage à ne pas embaucher directement ou indirectement toute ressource fournie par le Prestataire pendant la durée du contrat et pour une période de douze (12) mois suivant sa fin. En cas de non-respect, une indemnité équivalente à douze (12) mois de rémunération de la ressource concernée sera due.",
            terminationTitle: 'Résiliation',
            terminationPara: "Préavis minimal de 15 jours ouvrables par écrit. Les services rendus jusqu'à la date effective de résiliation sont facturés au prorata.",
        },
    },
    en: {
        section1Title: '1.  Object of the contract',
        section1Intro: 'This contract sets out the conditions under which VNK Automatisation Inc. (the "Provider") supplies the Client with professional services in industrial automation, including in particular:',
        section1Bullets: [
            'PLC support, remote or on-site (diagnosis, troubleshooting, optimization)',
            'Technical audit, documentation and modernization of automated systems',
            'Provision of specialized technical resources',
        ],
        section1Outro: 'The specific terms of each engagement are set out in a quote or annex signed by the Parties.',
        section2Title: '2.  Engagement covered by this contract',
        section2QuoteRef: (num, amount) => `Quote reference: ${num}  —  Total amount: ${amount} (incl. tax)`,
        section2Fallback: 'Industrial automation services as previously agreed.',
        section24Title: '33.  Signatures',
        section24Para: (date) => `Made in two original copies. The undersigned declare having read, understood and accepted the terms of this contract dated ${date}.`,
        annexesIntro: 'This contract includes the following annexes, integrated and forming an integral part of the agreement:',
        annexesTable: [
            ['Annex A', 'Service Level Agreement (SLA)'],
            ['Annex B', 'Recurring monthly support contract'],
            ['Annex C', 'Official VNK rate schedule'],
            ['Annex D', 'Provision of technical resources'],
        ],
        clauses: [
            ['3.  Contractual documents',
                `This contract includes, in order of precedence: (a) this contract and its annexes; (b) the quote accepted by the Client; (c) purchase orders issued by the Client; (d) any written agreement signed between the Parties.`],
            ['4.  Compensation and payment terms',
                `The Client agrees to pay the amounts set out in the quote. A 50% deposit is due upon signature. The balance is payable within 30 days following the issue of the final invoice. Any late payment incurs interest of 2% per month (24% per year). The Provider may suspend services in case of non-payment. Amounts exclude GST and QST. The Provider reserves the right to revise its rates annually with 30 days' written notice.`],
            ['5.  Expenses and reimbursements',
                `The Client reimburses reasonable expenses: travel ($0.70/km), accommodation, meals during on-site work, materials or licenses required. Deposits are non-refundable except for cancellation solely attributable to the Provider. Any cancellation by the Client after work has begun is billed pro rata. Late cancellation (less than 5 business days): 50% of the planned amount may be invoiced.`],
            ['6.  Client obligations',
                `The Client agrees to: (a) provide secure and functional access to systems and all necessary technical documents; (b) designate a qualified and available technical contact; (c) inform the Provider of any safety constraints and maintenance windows; (d) ensure that systems are accessible and in a state allowing intervention; (e) comply with safety standards and internal procedures. Any delay attributable to the Client results in additional fees and a schedule adjustment.`],
            ['7.  Performance deadlines',
                `The Provider undertakes to respect the deadlines in the quote, except for: (a) unforeseeable technical issues at the time of signature; (b) delays attributable to the Client; (c) cases of force majeure. In the event of an overrun solely caused by the Provider, the Client provides written notice and the parties agree on a new schedule before any further recourse.`],
            ['8.  Safety of interventions',
                `Work on PLC/SCADA/HMI systems carries inherent risks. Accordingly: (a) The Client is solely responsible for activating physical safety systems (LOTO, emergency stops) before and during any intervention; (b) program modifications shall be tested offline then in manual mode before going into production; (c) the Client must have qualified personnel on-site during remote interventions on production systems; (d) for on-site interventions, the technician will comply with the Client's internal rules, to be received in writing prior to the intervention; (e) the Provider will never modify certified safety functions (safety PLC, relays, emergency stops) without prior written authorization and documentation.`],
            ['9.  Cybersecurity and remote access',
                `Access to systems is carried out exclusively through secure channels (VPN, encrypted connection). The Provider undertakes to: (a) use access only for the strict needs of the engagement; (b) protect credentials; (c) immediately report any detected security incident; (d) notify the Client to revoke access at the end of the engagement. The Client is responsible for network segmentation isolating its industrial systems. Applicable practices are aligned with the ISA/IEC 62443 series (current edition, notably 62443-4-1 for secure development lifecycle and 62443-4-2 for IACS components) and, for the Provider's information security management system, with ISO/IEC 27001.`],
            ['10.  Backup and data integrity',
                `Before any modification, the Provider performs a complete backup of PLC, HMI and SCADA programs. A copy is given to the Client. In the event of an incident during the intervention, the Provider undertakes to restore from this backup. The Client remains responsible for maintaining its own backups independently. The Provider cannot be held responsible for pre-existing data not backed up by the Client.`],
            ['11.  Insurance',
                `The Provider declares maintaining adequate professional liability insurance covering its activities. Proof of insurance can be provided upon request.`],
            ['12.  Subcontracting',
                `The Provider may use qualified subcontractors. It remains responsible for service quality and compliance with contractual obligations.`],
            ['13.  Intellectual property and deliverables',
                `PLC, HMI, SCADA programs and any documentation specifically developed become the exclusive property of the Client after full payment. The Provider's generic methods, tools and know-how remain its exclusive property. The Provider may reference the existence of the engagement for commercial purposes, without disclosing confidential information.`],
            ['14.  Confidentiality and personal information protection',
                `The Parties treat as strictly confidential all information exchanged (PLC programs, schematics, industrial processes, financial information). This obligation survives the end of the contract for five (5) years. A separate NDA may be signed upon request for engagements involving sensitive information. Personal information that may be collected is processed in accordance with the Quebec Act respecting the protection of personal information in the private sector ("Law 25") and, where applicable, with the Personal Information Protection and Electronic Documents Act (PIPEDA, federal). For information relating to European Economic Area residents, the Parties agree to incorporate by reference the European Commission's Standard Contractual Clauses (Decision 2021/914) in a separate annex as needed. Business contact information used strictly within the scope of the engagement does not constitute personal information under PIPEDA.`],
            ['15.  Warranty and rectification',
                `The Provider warrants the conformity of the deliverables for 90 days following acceptance. During this period, it corrects without charge any malfunction directly attributable to the intervention. The warranty excludes: (a) modifications by the Client or a third party; (b) material wear; (c) pre-existing issues not reported.`],
            ['16.  Intervention report',
                `At the end of each engagement, the Provider provides a written report detailing: (a) work performed and modifications made; (b) tests and their results; (c) before/after state; (d) maintenance recommendations; (e) list of backups. Failing written objection from the Client within 10 business days, the work is deemed accepted.`],
            ['17.  Limitation of liability',
                `The Provider's total liability is limited to the total amount invoiced for the engagement. The Provider cannot be held responsible for: (a) loss of operations, production stoppages, loss of profits; (b) indirect or consequential damages; (c) damages resulting from unauthorized modifications after delivery; (d) pre-existing material failures; (e) consequences of non-conforming use. This limitation applies to the fullest extent permitted by Quebec law.`],
            ['18.  Exclusion — safety systems',
                `The Provider cannot be held responsible for bodily injury, material or environmental damage resulting from: (a) failure of safety systems outside the scope of the engagement; (b) activation/deactivation by the Client outside agreed procedures; (c) use under conditions different from those of the quote; (d) the Client's failure to comply with applicable safety rules (LSST, RSST, NFPA 70E, IEC 61508, ISO 13849). The Client acknowledges that any PLC/SCADA/HMI system controlling hazardous equipment requires complete validation before being put back into service.`],
            ['19.  Non-solicitation',
                `The Client agrees not to solicit or hire, directly or indirectly, the Provider's resources who have been personally and substantially involved in the performance of this engagement, during the term of the contract and for twelve (12) months following its end. This clause is ancillary to the principal services contract, limited in scope (resources directly involved in the engagement), in duration (12 months) and in territory (jurisdictions where the Provider operates), in accordance with the exception provided under paragraph 45(4) of the Competition Act (Canada). In case of non-compliance, an indemnity equivalent to twelve (12) months' gross compensation of the resource concerned will be due, as liquidated damages. This clause does not apply to candidates responding to a non-targeted public job posting.`],
            ['20.  Non-exclusivity',
                `This contract grants no exclusivity to the Client. The Provider remains free to provide similar services to other clients.`],
            ['21.  Termination',
                `Each Party may terminate with 30 days' written notice. Work completed and expenses incurred are invoiced pro rata. In the event of a serious breach not corrected within 15 days following formal notice, termination may be immediate. The Provider will never leave a system in an unstable or dangerous state; a minimum stabilization phase will be completed before the end of the work.`],
            ['22.  Force majeure',
                `The Parties incorporate by reference the "ICC Force Majeure Clause 2020 — Long Form" published by the International Chamber of Commerce, which notably covers: natural disasters, armed conflicts, international sanctions, third-party cyberattacks, Internet infrastructure outages, pandemics, general strikes, supply chain disruptions (including semiconductors and critical industrial components) and government decisions. Neither Party will be held responsible for a failure caused by such an event. The affected party notifies the other within forty-eight (48) hours and takes all reasonable measures to limit the impact. If the situation lasts more than sixty (60) days, either Party may terminate the contract without penalty, subject to payment for work delivered.`],
            ['23.  Governing law and dispute resolution',
                `This contract is governed by the laws of the province of Quebec and the applicable federal laws of Canada. In the event of a dispute, the parties shall attempt amicable resolution within thirty (30) days following written notice. Failing this, and except as otherwise provided below, the dispute is submitted to the exclusive jurisdiction of the courts of the judicial district of Quebec. For contracts with a Client whose headquarters is outside Canada, the Parties may agree in writing to submit the dispute to final and binding arbitration under the Rules of Arbitration of the International Chamber of Commerce (ICC), seat in Montreal or Paris, in French or English, by one (1) sole arbitrator for disputes below 250,000 CAD and three (3) arbitrators above. This contract constitutes the entire agreement between the Parties and supersedes any prior agreement. Any modification must be made in writing and signed by both Parties. If any clause is held invalid, the remaining clauses remain in effect.`],
            ['24.  Electronic signature',
                `The Parties acknowledge that the signature of this contract by electronic means (including scanned handwritten signature, canvas signature, or signature certified by RFC 3161 timestamp) has the same legal value as a handwritten signature. This recognition is based on article 2827 of the Civil Code of Quebec, on articles 5 to 11 of the Act to establish a legal framework for information technology (CQLR c C-1.1), and on Part 2 of the Personal Information Protection and Electronic Documents Act (PIPEDA) along with the Secure Electronic Signature Regulations (SOR/2005-30) at the federal level. Signed PDF files and their metadata (IP, timestamp, user agent) constitute admissible evidence.`],
            ['25.  Currency and foreign exchange risk',
                `Unless otherwise stated in the quote, all amounts are denominated in Canadian dollars (CAD). For a Client invoiced in another currency, conversion is made at the Bank of Canada reference rate on the invoice issue date. Foreign exchange risk remains the Client's responsibility. The Provider may adjust future amounts if the rate varies by more than five percent (5%) between the quote date and the invoicing date, with prior written notice.`],
            ['26.  Export controls and sanctions',
                `The Client represents and warrants that it is not and will not be, during the term of the contract, designated on lists of persons or entities sanctioned under the Special Economic Measures Act (Canada), the United Nations Act, the Justice for Victims of Corrupt Foreign Officials Act, nor on the lists of OFAC (United States), the European Union, the United Kingdom or the United Nations. The Client also warrants that the services provided will not be used for purposes prohibited by the Export and Import Permits Act (Canada) or any equivalent regime. The Provider may suspend or terminate without penalty any engagement whose performance would violate an applicable sanctions regime, subject to payment for work delivered.`],
            ['27.  Electronic communications',
                `The Parties mutually consent to receiving electronic communications (emails, messages via the client portal, notifications) in connection with this contract and the existing business relationship (EBR) arising therefrom. The Client consents to receive commercial electronic messages from the Provider for the duration of the contract and for twenty-four (24) months following its end, in accordance with Canada's Anti-Spam Legislation (CASL). The Client may withdraw consent at any time via the unsubscribe mechanism included in each communication.`],
            ['28.  Refund policy',
                `The Client is entitled to a full or partial refund in the following cases: (a) cancellation of the engagement by the Provider before any work has begun; (b) inability of the Provider to deliver the services for reasons exclusively attributable to it, not corrected within fifteen (15) days following written formal notice; (c) major non-conformity of deliverables not rectified under the warranty (clause 15). No refund is due in the event of: change of mind by the Client after work has begun, refusal by the Client to provide required access or cooperation, force majeure (clause 22), or non-compliant use. The refund is issued within thirty (30) days of written agreement between the Parties, by the same payment method as the original transaction. Bank fees, non-recoverable Stripe fees and foreign exchange fees are deducted. The balance for work actually delivered and accepted remains billable.`],
            ['29.  Dispute management procedure',
                `Before any judicial or arbitration recourse (clause 23), the Parties commit to following this escalation procedure: (a) Level 1 — detailed written notice from the claiming party to the other party's account manager, response expected within five (5) business days; (b) Level 2 — if unresolved, escalation to each party's designated representative (for the Provider: Yan Verone Kengne, President), resolution attempt within fifteen (15) days; (c) Level 3 — mediation by a neutral third party jointly appointed (Quebec Mediation and Arbitration Institute or equivalent), over thirty (30) days; (d) Level 4 — recourse under clause 23. Undisputed amounts remain payable according to scheduled deadlines. Work unrelated to the dispute continues normally. Any delay in this procedure suspends any late-payment interest on disputed amounts.`],
            ['30.  Service credits (SLA)',
                `If the Provider fails to meet the response times defined in Annex A (SLA), the Client is entitled to a service credit applicable on the current month's invoice, according to the following scale: overrun up to 25% of the target time = 5% credit on the monthly plan; overrun from 25% to 100% = 15% credit; overrun greater than 100% = 25% credit. The total monthly credit is capped at fifty percent (50%) of the monthly plan. Credits are automatically applied to the next invoice and do not entitle to a monetary refund. Credits do not apply in cases of force majeure, unavailability caused by the Client, or for interventions outside the plan.`],
            ['31.  Acceptance, rejection and complaints',
                `Upon delivery of each engagement or milestone, the Provider provides the intervention report set out in clause 16. The Client has ten (10) business days to notify in writing any substantial non-conformity identified. The rejection must precisely identify the non-compliant element and the unmet specification. The Provider then has a reasonable period (generally fifteen (15) business days) to rectify at no additional cost. After two (2) unsuccessful rectification attempts on the same point, the Client may: (a) accept as-is with a negotiated credit; (b) request a partial refund proportional to the non-compliant portion (clause 28). Failing written objection within ten (10) business days, deliverables are deemed accepted and the warranty under clause 15 takes effect.`],
            ['32.  Payment disputes and chargebacks',
                `The Client agrees to contact the Provider before initiating any chargeback with its bank, Stripe or its card issuer, and to first follow the dispute management procedure (clause 29). Any chargeback initiated without prior attempt at amicable resolution constitutes a breach of this contract. If the chargeback is deemed unjustified by the issuer or Stripe, the processing costs incurred by the Provider (including Stripe dispute fee of 15 USD per chargeback, plus defense time at the hourly rate in Annex C) are billed to the Client. The Provider retains all delivery and communication evidence necessary to defend a chargeback for at least seven (7) years, in accordance with Canadian accounting retention requirements.`],
        ],
        annexA: {
            title: 'Annex A — Service Level Agreement (SLA)',
            intro: 'This annex defines the service levels applicable to technical support services provided by VNK Automatisation Inc. as part of industrial automation services.',
            coverageTitle: 'Scope of services covered',
            coverageItems: [
                'PLC, HMI and SCADA support',
                'Diagnosis and troubleshooting, remote or on-site',
                'Technical assistance during commissioning',
                'Industrial network support and basic cybersecurity',
            ],
            slaLevelsTitle: 'Service levels and response times',
            slaLevelsHeaders: ['Level', 'Availability', 'Response time', 'Takeover time'],
            slaLevelsRows: [
                ['Standard', 'Mon–Fri, 8am–5pm', '24 business hours', '48 h'],
                ['Priority', 'Mon–Fri, 8am–8pm', '8 business hours', '24 h'],
                ['Emergency', '24/7', '2 hours', 'Immediate based on availability'],
            ],
            classifTitle: 'Incident classification',
            classifHeaders: ['Level', 'Description', 'Example'],
            classifRows: [
                ['Critical', 'Complete production stoppage', 'PLC out of service'],
                ['Major', 'Degraded operation', 'Network or communication fault'],
                ['Minor', 'Non-blocking issue', 'Parameter adjustment'],
            ],
            exclusionsTitle: 'SLA exclusions',
            exclusionsItems: [
                'Hardware failures unrelated to services provided',
                'Unauthorized modifications by the Client or a third party',
                'Force majeure events',
                'Systems not covered by the current engagement',
            ],
        },
        annexB: {
            title: 'Annex B — Recurring monthly support contract',
            intro: 'This annex defines the terms of recurring technical support in industrial automation. The Client chooses one of the plans below according to its needs.',
            plansTitle: 'Available monthly plans',
            plansHeaders: ['Plan', 'Hours included', 'Response time', 'Monthly rate'],
            plansRows: [
                ['Essential', '5 hours', '24 business hours', '1,000 CAD'],
                ['Professional', '10 hours', '8 business hours', '1,800 CAD'],
                ['Premium', '20 hours', '4 business hours', '3,200 CAD'],
            ],
            plansNote: 'Hours beyond the plan are billed according to the official rate schedule (Annex C). Unused hours within the month are not carried over.',
            durationTitle: 'Duration and renewal',
            durationPara: 'Initial term of 12 months. Automatic renewal unless written notice of termination 30 days before expiry. Monthly billing payable within 30 days.',
            specialTitle: 'Special conditions',
            specialItems: [
                'The plan is activated upon receipt of the deposit for the first month.',
                'The service level (response time) is guaranteed within the limits of the chosen plan.',
                'Emergency interventions outside the plan carry a 25% surcharge (see Annex C).',
                'The Client may change plans with 30 days\' written notice.',
            ],
        },
        annexC: {
            title: 'Annex C — Official VNK Automatisation Inc. rate schedule',
            intro: (date) => `Rates in effect as of ${date}. All prices are in Canadian dollars (CAD), taxes extra (GST 5% + QST 9.975%).`,
            techTitle: 'Technical services',
            techHeaders: ['Service', 'Rate'],
            techRows: [
                ['Remote PLC support', '120 – 150 CAD / hour'],
                ['On-site intervention', '140 – 180 CAD / hour'],
                ['Prepaid hour bank (10 h)', '1,100 CAD (savings of 400 CAD)'],
                ['Standard monthly plan', '1,200 CAD / month'],
                ['Priority monthly plan', '2,500 CAD / month (guaranteed response)'],
            ],
            auditTitle: 'Technical audit',
            auditHeaders: ['Audit type', 'Rate', 'Description'],
            auditRows: [
                ['Standard audit', '1,500 – 2,500 CAD', 'Simple system — 1 to 2 PLCs'],
                ['Complete audit', '2,500 – 4,000 CAD', 'Complex system — multiple PLCs'],
            ],
            docTitle: 'Industrial documentation',
            docHeaders: ['Type', 'Rate', 'Description'],
            docRows: [
                ['Basic documentation', '800 – 2,000 CAD', 'Operator and maintenance procedures'],
                ['Complete documentation', '2,000 – 5,000 CAD', 'All-inclusive — code, procedures, schematics'],
            ],
            refacTitle: 'PLC refactoring',
            refacHeaders: ['Type', 'Rate', 'Description'],
            refacRows: [
                ['Partial refactoring', '3,000 – 10,000 CAD', 'Targeted modules or sections'],
                ['Complete refactoring', '10,000 – 25,000 CAD', 'Complete program restructured'],
                ['New implementation', '5,000 – 50,000 CAD', 'Full rewrite or new project'],
            ],
            extraTitle: 'Additional fees',
            extraHeaders: ['Fee type', 'Rate'],
            extraRows: [
                ['Travel', '0.70 CAD / km'],
                ['Travel time', '50% of hourly rate'],
                ['Emergency intervention', '25% surcharge'],
                ['Outside business hours intervention', '50% surcharge'],
            ],
        },
        annexD: {
            title: 'Annex D — Provision of technical resources',
            intro: 'This annex governs the supply of specialized technical resources by VNK Automatisation Inc. to the Client for temporary or recurring engagements in industrial automation.',
            typesTitle: 'Available resource types',
            typesItems: [
                'PLC programmers (Siemens, Rockwell, B&R, Schneider)',
                'Industrial automation technicians',
                'HMI / SCADA specialists (WinCC, FactoryTalk, Wonderware)',
                'Industrial network experts (Profinet, EtherNet/IP, Modbus)',
            ],
            ratesTitle: 'Indicative pricing',
            ratesHeaders: ['Profile', 'Daily rate (8 h)'],
            ratesRows: [
                ['Automation technician', '700 – 900 CAD / day'],
                ['PLC programmer', '900 – 1,200 CAD / day'],
                ['Senior expert', '1,200 – 1,600 CAD / day'],
            ],
            ratesNote: 'Travel, accommodation and other authorized expenses are billed in addition according to the rate schedule (Annex C).',
            modalitiesTitle: 'Intervention terms',
            modalitiesItems: [
                'Resources remain under the contractual and administrative responsibility of the Provider.',
                'The Client provides daily operational supervision of the resources made available.',
                'The Client undertakes to provide a working environment compliant with applicable health and safety standards.',
                'Monthly billing or as per the terms of the quote, payable within 30 days.',
            ],
            nonSolicitTitle: 'Non-solicitation',
            nonSolicitPara: 'The Client agrees not to directly or indirectly hire any resource provided by the Provider during the term of the contract and for a period of twelve (12) months following its end. In case of non-compliance, an indemnity equivalent to twelve (12) months\' compensation of the resource concerned will be due.',
            terminationTitle: 'Termination',
            terminationPara: 'Minimum written notice of 15 business days. Services rendered up to the effective termination date are invoiced pro rata.',
        },
    },
};

function getContractText(lang) {
    return CONTRACT_TEXT[lang === 'en' ? 'en' : 'fr'];
}

function fmtForLang(v, lang) {
    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(parseFloat(v) || 0);
}

function dateForLang(d, lang) {
    if (!d) return '—';
    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    return new Date(d).toLocaleDateString(locale);
}

// ─────────────────────────────────────────────
// CONSTANTES VNK
// ─────────────────────────────────────────────
const C = {
    // Couleurs
    blue: '#1B4F8A',   // primaire
    blueMid: '#2E86AB',   // secondaire
    navy: '#0F2D52',   // foncé
    navyDeep: '#0A1F3A',   // footer facture
    green: '#27AE60',   // payée / succès
    greenLight: '#EBF7F0',   // fond badge payée
    amber: '#D97706',   // en attente
    amberLight: '#FEF3C7',   // fond badge attente
    gray: '#64748B',   // texte secondaire
    grayLight: '#F8FAFC',   // fond alterné
    border: '#E2E8F0',   // bordures
    text: '#1E293B',   // texte principal
    white: '#FFFFFF',

    // Coordonnées de page LETTER
    marginL: 40,
    marginR: 40,

    // Infos société
    name: 'VNK Automatisation Inc.',
    neq: '1181943359',
    email: 'vnkautomatisation@gmail.com',
    phone: '(819) 290-8686',
    address: 'Québec, QC, Canada',
    tps: 'À compléter (Revenu Canada)',
    tvq: 'À compléter (Revenu Québec)',
    site: 'vnk-website-production.up.railway.app',
    founder: 'Yan Verone Kengne',
    title: 'Président'
};

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────

function fmt(v) {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(parseFloat(v) || 0);
}

function dateCA(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-CA');
}

function pageWidth(doc) { return doc.page.width; }
function contentWidth(doc) { return doc.page.width - C.marginL - C.marginR; }

// Badge VNK carre arrondi — matche public-nav.tsx (bg-white/10 + border-white/20 + VNK blanc)
// r = demi-cote du carre (donc cote total = 2r), centre en (cx, cy)
function drawHexLogo(doc, cx, cy, r, fillColor, strokeColor) {
    const size = r * 2;
    const x = cx - r;
    const y = cy - r;
    const radius = r * 0.35; // ratio 14/40 ≈ rounded-lg

    // Fond white/10
    doc.save().fillOpacity(0.10);
    doc.roundedRect(x, y, size, size, radius);
    doc.fillColor(fillColor || '#FFFFFF').fill();
    doc.restore();

    // Bordure white/30
    doc.save().lineWidth(1.5).strokeOpacity(0.30);
    doc.roundedRect(x, y, size, size, radius);
    doc.strokeColor(strokeColor || '#FFFFFF').stroke();
    doc.restore();

    // Texte VNK centre
    const fontSize = Math.max(7, r * 0.55);
    doc.fillColor('#FFFFFF').fillOpacity(1).fontSize(fontSize).font('Helvetica-Bold')
        .text('VNK', x, cy - fontSize * 0.50, { width: size, align: 'center', characterSpacing: 1.0 });
}

// Barre de section avec accent latéral bleu
function sectionBar(doc, label, accentColor) {
    accentColor = accentColor || C.blue;
    const w = contentWidth(doc);
    const y = doc.y;
    doc.rect(C.marginL, y, w, 22).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, y, 3, 22).fillColor(accentColor).fill();
    doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold')
        .text(label.toUpperCase(), C.marginL + 10, y + 7, { width: w - 20, characterSpacing: 0.4 });
    doc.y = y + 30;
}

// Ligne label / valeur dans un bloc info
function infoLine(doc, label, value, xLabel, xValue, y, valueWidth) {
    valueWidth = valueWidth || 200;
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(label, xLabel, y, { width: 90 });
    doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
        .text(value || '—', xValue, y, { width: valueWidth });
    return y + 15;
}

// Bloc info encadré (titre + lignes label/valeur)
function infoBox(doc, x, y, w, h, accentColor, title, rows) {
    accentColor = accentColor || C.blue;
    doc.rect(x, y, w, h).fillColor(C.grayLight).fill();
    doc.rect(x, y, w, h).lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();
    doc.rect(x, y, 3, h).fillColor(accentColor).fill();
    // Titre du bloc
    doc.fillColor(accentColor).fontSize(7.5).font('Helvetica-Bold')
        .text(title, x + 10, y + 8, { width: w - 16, characterSpacing: 0.5 });
    // Séparateur titre
    doc.moveTo(x + 8, y + 20).lineTo(x + w - 8, y + 20)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();
    // Lignes de données
    let ry = y + 26;
    rows.forEach(([lbl, val]) => {
        ry = infoLine(doc, lbl, val, x + 10, x + 90, ry, w - 100);
    });
}

// Tableau de services
function serviceTable(doc, lines, t) {
    t = t || getDict('fr');
    const w = contentWidth(doc);
    const colDesc = C.marginL;
    const colQty = C.marginL + w * 0.55;
    const colUnit = C.marginL + w * 0.65;
    const colHT = C.marginL + w * 0.78;
    const startY = doc.y;

    // En-tête
    doc.rect(C.marginL, startY, w, 20).fillColor(C.blue).fill();
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold')
        .text(t.tableDescription, colDesc + 4, startY + 6, { width: w * 0.52 })
        .text(t.tableQty, colQty, startY + 6, { width: w * 0.09, align: 'center' })
        .text(t.tableUnit, colUnit, startY + 6, { width: w * 0.12, align: 'center' })
        .text(t.tableAmount, colHT, startY + 6, { width: w * 0.22, align: 'right' });

    doc.y = startY + 24;
    let totalHT = 0;

    lines.forEach((line, i) => {
        const rowY = doc.y;
        const bg = i % 2 === 0 ? C.white : C.grayLight;

        // Calculer la hauteur nécessaire pour la description
        const descHeight = Math.max(22,
            doc.heightOfString(line.description || '', { width: w * 0.52 - 8 }) + 10
        );

        doc.rect(C.marginL, rowY, w, descHeight).fillColor(bg).fill();
        doc.rect(C.marginL, rowY, w, descHeight)
            .lineWidth(0.5).strokeColor(C.border).strokeOpacity(0.5).stroke();

        doc.fillColor(C.text).fontSize(8).font('Helvetica')
            .text(line.description || '', colDesc + 4, rowY + 6, { width: w * 0.52 - 8 })
            .text(String(line.qty || 1), colQty, rowY + 6, { width: w * 0.09, align: 'center' })
            .text(line.unit || 'h', colUnit, rowY + 6, { width: w * 0.12, align: 'center' })
            .text(fmt(line.amount_ht), colHT, rowY + 6, { width: w * 0.22, align: 'right' });

        totalHT += parseFloat(line.amount_ht || 0);
        doc.y = rowY + descHeight + 2;
    });

    return totalHT;
}

// Bloc totaux (droite aligné)
function taxBlock(doc, ht, tps, tvq, ttc, totalLabel, t) {
    t = t || getDict('fr');
    const w = contentWidth(doc);
    const boxW = 210;
    const boxX = C.marginL + w - boxW;
    let y = doc.y + 12;

    // Fond du bloc
    doc.rect(boxX - 4, y - 6, boxW + 4, 72).fillColor(C.grayLight).fill();
    doc.rect(boxX - 4, y - 6, boxW + 4, 72)
        .lineWidth(0.5).strokeColor(C.border).strokeOpacity(1).stroke();

    const rows = [
        [t.tableSubtotal, fmt(ht)],
        [t.tableGst, fmt(tps)],
        [t.tableQst, fmt(tvq)],
    ];
    rows.forEach(([l, v]) => {
        doc.fillColor(C.gray).fontSize(8).font('Helvetica')
            .text(l, boxX, y, { width: 100 });
        doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
            .text(v, boxX + 100, y, { width: boxW - 104, align: 'right' });
        y += 16;
    });

    // Ligne séparatrice
    doc.moveTo(boxX, y - 4).lineTo(boxX + boxW, y - 4)
        .lineWidth(0.5).strokeColor(C.border).stroke();

    // Total final
    y += 2;
    doc.rect(boxX - 4, y - 4, boxW + 4, 26).fillColor(C.blue).fill();
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
        .text(totalLabel || t.tableTotal, boxX, y + 4, { width: 100 });
    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
        .text(fmt(ttc), boxX + 100, y + 2, { width: boxW - 104, align: 'right' });

    doc.y = y + 40;
}

// Footer commun
function drawFooter(doc, docNumber, bgColor, t) {
    t = t || getDict('fr');
    bgColor = bgColor || C.navy;
    const w = pageWidth(doc);
    const y = doc.page.height - 44;
    doc.rect(0, y, w, 44).fillColor(bgColor).fill();
    // Ligne déco
    doc.rect(0, y, w, 2).fillColor(C.blueMid).fillOpacity(0.5).fill().fillOpacity(1);
    const lang = t === I18N.en ? 'en' : 'fr';
    doc.fillColor('#AABBCC').fontSize(7).font('Helvetica')
        .text(`${C.name}  ·  ${C.site}  ·  ${C.email}  ·  ${C.phone}`,
            C.marginL, y + 10, { width: w - 80, align: 'center' })
        .text(`${docNumber}  ·  ${t.generatedOn} ${dateForLang(new Date(), lang)}  ·  ${t.document}`,
            C.marginL, y + 24, { width: w - 80, align: 'center' });
}

// Badge statut coloré (EN ATTENTE / PAYÉE / etc.)
function statusBadge(doc, x, y, label, bgColor, textColor) {
    const badgeW = 90, badgeH = 14;
    doc.rect(x, y, badgeW, badgeH).fillColor(bgColor).fill();
    doc.fillColor(textColor).fontSize(7).font('Helvetica-Bold')
        .text(label, x, y + 3.5, { width: badgeW, align: 'center', characterSpacing: 0.3 });
}


// ─────────────────────────────────────────────
// TEMPLATE 1 — DEVIS
// Header bleu primaire · accent secondaire sur infos client
// ─────────────────────────────────────────────
async function generateQuotePDF(res, quote, client, lines, opts) {
    opts = opts || {};
    const lang = opts.lang === 'en' ? 'en' : 'fr';
    const t = getDict(lang);
    const dateLoc = (d) => dateForLang(d, lang);
    const fmtLoc = (v) => fmtForLang(v, lang);

    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quote.quote_number}.pdf"`);
    doc.pipe(res);

    const w = pageWidth(doc);
    const cw = contentWidth(doc);
    const pH = doc.page.height;   // 792 pts
    const hdrH = 108;              // hauteur header
    const ftrY = pH - 44;         // Y début footer

    // ── Helper : dessine le header identique sur chaque page ──────────────
    function drawHeader() {
        doc.rect(0, 0, w, hdrH).fillColor(C.blue).fill();
        doc.rect(0, hdrH - 4, w, 4).fillColor(C.blueMid).fillOpacity(0.7).fill().fillOpacity(1);
        doc.rect(0, hdrH, w, 2).fillColor(C.blueMid).fillOpacity(0.3).fill().fillOpacity(1);

        drawHexLogo(doc, 62, 54, 34, C.white, C.white);

        doc.fillColor(C.white).fontSize(16).font('Helvetica-Bold')
            .text(C.name, 108, 24);
        doc.fillColor('rgba(255,255,255,0.85)').fontSize(7.5).font('Helvetica')
            .text('VALUE · NETWORK · KNOWLEDGE', 109, 44, { characterSpacing: 1.5 });
        doc.fillColor('#A8C4D8').fontSize(7)
            .text('NEQ : ' + C.neq, 109, 56);
        doc.fillColor('#A8C4D8').fontSize(7)
            .text(C.email + '  ·  ' + C.phone + '  ·  ' + C.site, 109, 67);

        // Badge numéro de devis
        const bx = w - 152, by = 16, bw = 124, bh = 76;
        doc.rect(bx, by, bw, bh).fillColor('#1E5A9C').fill();
        doc.rect(bx, by, bw, bh).lineWidth(0.5).strokeColor('#4A7FBF').stroke();
        doc.rect(bx, by, 3, bh).fillColor(C.blueMid).fill();
        doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
            .text(t.quoteHeader, bx + 4, by + 12, { width: bw - 8, align: 'center', characterSpacing: 2.5 });
        doc.moveTo(bx + 10, by + 30).lineTo(bx + bw - 10, by + 30)
            .lineWidth(0.3).strokeColor('#4A7FBF').stroke();
        doc.fillColor(C.white).fontSize(9.5).font('Helvetica')
            .text(quote.quote_number, bx + 4, by + 36, { width: bw - 8, align: 'center' });
        doc.fillColor('#A8C4D8').fontSize(7.5)
            .text(dateLoc(quote.created_at), bx + 4, by + 53, { width: bw - 8, align: 'center' });
    }

    // ── Helper : dessine le footer ────────────────────────────────────────
    function drawFtr() { drawFooter(doc, quote.quote_number, C.navy, t); }

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 1  — Header · Infos · Description · [espace] · Tableau · Total
    // ══════════════════════════════════════════════════════════════════════
    drawHeader();

    // Blocs infos côte à côte
    const halfW = (cw - 12) / 2;
    const infoH = 108;
    const infoY = hdrH + 20;
    infoBox(doc, C.marginL, infoY, halfW, infoH, C.blueMid, t.client, [
        [t.name, client.full_name],
        [t.company, client.company_name],
        [t.email, client.email],
        [t.phone, client.phone],
        [t.city, (client.city || '') + ' ' + (client.province || '')],
    ]);
    infoBox(doc, C.marginL + halfW + 12, infoY, halfW, infoH, C.blue, t.quoteDetails, [
        [t.quoteNumber, quote.quote_number],
        [t.quoteDate, dateLoc(quote.created_at)],
        [t.quoteExpiry, quote.expiry_date ? dateLoc(quote.expiry_date) : t.quoteExpiryDefault],
        [t.quoteStatus, quote.status === 'accepted' ? t.quoteStatusApproved : t.quoteStatusPending],
    ]);

    // Section description — juste en dessous des infos
    doc.y = infoY + infoH + 16;
    sectionBar(doc, t.quoteServicesDesc);
    doc.fillColor(C.text).fontSize(9.5).font('Helvetica-Bold')
        .text(quote.title, C.marginL, doc.y, { width: cw });
    doc.y += 16;
    if (quote.description) {
        doc.fillColor(C.gray).fontSize(8.5).font('Helvetica')
            .text(quote.description, C.marginL, doc.y, { width: cw, lineGap: 4 });
        doc.y += doc.heightOfString(quote.description, { width: cw }) + 10;
    }

    // ── Tableau + Total ancrés ensemble en bas de page ─────────────────────
    // Estimation : sectionBar(30) + header_table(24) + lignes(~28 chacune) + taxBlock(90)
    const nbLines = (lines && lines.length) ? lines.length : 1;
    const tableEst = 30 + 24 + nbLines * 30 + 90 + 20; // marge de sécurité
    const tableTopY = ftrY - tableEst;                   // Y idéal pour commencer le tableau

    // On descend jusqu'à tableTopY seulement si on est encore au-dessus
    if (doc.y < tableTopY) doc.y = tableTopY;

    sectionBar(doc, t.quoteServiceLines);
    const tableLines = (lines && lines.length) ? lines : [{
        description: quote.title,
        qty: 1, unit: t.unitDefault, amount_ht: quote.amount_ht
    }];
    serviceTable(doc, tableLines, t);

    // Total — s'il déborde on le laisse s'ajuster naturellement
    taxBlock(doc, quote.amount_ht, quote.tps_amount, quote.tvq_amount, quote.amount_ttc, t.quoteTotal, t);

    drawFtr();

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 2  — Même header · Conditions · Signature large · Footer
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    drawHeader();
    doc.y = hdrH + 28;

    // ── Conditions de paiement dynamiques selon le plan ──
    sectionBar(doc, t.quotePaymentTerms);
    const plan = quote.payment_plan || 'split_50_50';
    const pct1 = quote.payment_pct1 != null ? parseInt(quote.payment_pct1) : 50;
    const pct2 = quote.payment_pct2 != null ? parseInt(quote.payment_pct2) : 50;
    const ttcVal = parseFloat(quote.amount_ttc || 0);
    let conds = [];
    if (quote.payment_conditions && quote.payment_conditions.trim()) {
        // Conditions personnalisées par l'admin (pas de traduction automatique)
        conds = quote.payment_conditions.split('\n').filter(l => l.trim()).map(l => l.trim());
    } else if (plan === 'full') {
        conds = [t.quoteCondFull(fmtLoc(ttcVal))];
    } else {
        conds = [
            t.quoteCondDeposit(pct1, fmtLoc(ttcVal * pct1 / 100)),
            t.quoteCondBalance(pct2, fmtLoc(ttcVal * pct2 / 100)),
        ];
    }
    conds = conds.concat([
        t.quoteCondValid(dateLoc(quote.created_at)),
        t.quoteCondNotContract,
        t.quoteCondCurrency,
    ]);
    conds.forEach(c => {
        doc.fillColor(C.gray).fontSize(8.5).font('Helvetica')
            .text('•  ' + c, C.marginL + 10, doc.y, { width: cw - 10, lineGap: 3 });
        doc.y += 16;
    });
    doc.y += 18;

    // Acceptation
    sectionBar(doc, t.quoteAcceptance);
    doc.fillColor(C.gray).fontSize(8.5).font('Helvetica')
        .text(t.quoteAcceptanceText, C.marginL, doc.y, { width: cw, lineGap: 4 });
    doc.y += 32;

    // Zones de signature — larges et aérées
    const sigTopY = doc.y;
    const sigH = 110;  // hauteur généreuse
    const sigW = (cw - 24) / 2;

    // Bloc CLIENT
    const sx1 = C.marginL;
    doc.rect(sx1, sigTopY, sigW, sigH).fillColor(C.grayLight).fill();
    doc.rect(sx1, sigTopY, sigW, sigH).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.rect(sx1, sigTopY, 3, sigH).fillColor(C.blue).fill();
    doc.fillColor(C.blue).fontSize(8).font('Helvetica-Bold')
        .text(t.quoteSigClient, sx1 + 12, sigTopY + 10, { width: sigW - 20 });
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(t.name + ' : ' + (client.full_name || '______________________'), sx1 + 12, sigTopY + 24, { width: sigW - 20 });
    // Image signature si disponible
    if (quote.client_signature_data && quote.client_signature_data.startsWith('data:image/')) {
        try {
            const b64 = quote.client_signature_data.replace(/^data:image\/\w+;base64,/, '');
            const imgBuf = Buffer.from(b64, 'base64');
            doc.image(imgBuf, sx1 + 12, sigTopY + 38, { width: sigW - 24, height: 44, fit: [sigW - 24, 44] });
        } catch (e) { /* ignore */ }
    }
    // Ligne de signature
    doc.moveTo(sx1 + 12, sigTopY + 86).lineTo(sx1 + sigW - 12, sigTopY + 86)
        .lineWidth(0.5).strokeColor('#AABBCC').stroke();
    const sigDateStr = quote.signed_at ? dateLoc(quote.signed_at) : (quote.accepted_at ? dateLoc(quote.accepted_at) : '______________________');
    doc.fillColor(C.gray).fontSize(7).font('Helvetica')
        .text(t.signedBy + ' : ' + sigDateStr, sx1 + 12, sigTopY + 90, { width: sigW - 20 });

    // Bloc DATE
    const sx2 = C.marginL + sigW + 24;
    const isAccepted = quote.status === 'accepted';
    doc.rect(sx2, sigTopY, sigW, sigH).fillColor(isAccepted ? '#F0FDF4' : C.grayLight).fill();
    doc.rect(sx2, sigTopY, sigW, sigH).lineWidth(0.5).strokeColor(isAccepted ? '#A7F3D0' : C.border).stroke();
    doc.rect(sx2, sigTopY, 3, sigH).fillColor(isAccepted ? C.green : C.blue).fill();
    doc.fillColor(isAccepted ? C.green : C.blue).fontSize(8).font('Helvetica-Bold')
        .text(isAccepted ? t.quoteApproved : t.quoteSigDate, sx2 + 12, sigTopY + 10, { width: sigW - 20 });
    const acceptedDateStr = quote.accepted_at ? dateLoc(quote.accepted_at) : (quote.signed_at ? dateLoc(quote.signed_at) : null);
    if (isAccepted && acceptedDateStr) {
        doc.fillColor(C.green).fontSize(14).font('Helvetica-Bold')
            .text(acceptedDateStr, sx2 + 12, sigTopY + 34, { width: sigW - 24 });
        doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
            .text(t.quoteAcceptDate, sx2 + 12, sigTopY + 54, { width: sigW - 20 });
        // Badge vert approuvé
        doc.rect(sx2 + 12, sigTopY + 68, 90, 18).fillColor(C.green).fill();
        doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold')
            .text(t.quoteStatusApprovedShort, sx2 + 12, sigTopY + 72, { width: 90, align: 'center' });
    } else {
        doc.moveTo(sx2 + 12, sigTopY + 80).lineTo(sx2 + sigW - 12, sigTopY + 80)
            .lineWidth(0.5).strokeColor('#AABBCC').stroke();
        doc.fillColor(C.gray).fontSize(7).font('Helvetica')
            .text(t.quoteSigDateFmt, sx2 + 12, sigTopY + 84, { width: sigW - 20 });
    }

    doc.y = sigTopY + sigH + 24;

    // Tampon VNK en bas
    const stampY = doc.y;
    const stampH = 50;
    doc.rect(C.marginL, stampY, cw, stampH).fillColor('#EBF3FA').fill();
    doc.rect(C.marginL, stampY, cw, stampH).lineWidth(0.5).strokeColor('#BFD8EE').stroke();
    doc.rect(C.marginL, stampY, 3, stampH).fillColor(C.blue).fill();
    doc.fillColor(C.blue).fontSize(8).font('Helvetica-Bold')
        .text('VNK AUTOMATISATION INC.', C.marginL + 12, stampY + 10);
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(C.founder + ', ' + C.title, C.marginL + 12, stampY + 24);
    doc.fillColor(C.gray).fontSize(7)
        .text('Document généré le ' + dateCA(new Date()) + '  ·  ' + C.email,
            C.marginL + 12, stampY + 35);

    drawFtr();
    doc.end();
}


// ─────────────────────────────────────────────
// TEMPLATE 2 — FACTURE
// Header marine foncé · accent vert si payée · badge statut coloré
// ─────────────────────────────────────────────
async function generateInvoicePDF(res, invoice, client, opts) {
    opts = opts || {};
    const lang = opts.lang === 'en' ? 'en' : 'fr';
    const t = getDict(lang);
    const dateLoc = (d) => dateForLang(d, lang);

    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
    doc.pipe(res);

    const w = pageWidth(doc);
    const isPaid = invoice.status === 'paid';
    const accentColor = isPaid ? C.green : C.blueMid;

    // ── HEADER marine ────────────────────────
    const headerH = 108;
    doc.rect(0, 0, w, headerH).fillColor(C.navy).fill();
    doc.rect(0, headerH - 4, w, 4).fillColor(accentColor).fillOpacity(0.8).fill().fillOpacity(1);
    doc.rect(0, headerH, w, 2).fillColor(accentColor).fillOpacity(0.3).fill().fillOpacity(1);

    drawHexLogo(doc, 62, 54, 34, C.white, C.white);

    doc.fillColor(C.white).fontSize(16).font('Helvetica-Bold')
        .text(C.name, 108, 24);
    doc.fillColor('rgba(255,255,255,0.8)').fontSize(7.5).font('Helvetica')
        .text('VALUE · NETWORK · KNOWLEDGE', 109, 44, { characterSpacing: 1.5 });
    doc.fillColor('#A8C0D8').fontSize(7)
        .text(`NEQ : ${C.neq}`, 109, 56);
    doc.fillColor('#A8C0D8').fontSize(7)
        .text(`${C.email}  ·  ${C.phone}  ·  ${C.site}`, 109, 67);

    // Badge FACTURE
    const bx = w - 152, by = 16, bw = 124, bh = 76;
    doc.rect(bx, by, bw, bh).fillColor('#0C2344').fill();
    doc.rect(bx, by, bw, bh).lineWidth(0.5).strokeColor('#2A4D6E').stroke();
    doc.rect(bx, by, 3, bh).fillColor(accentColor).fill();
    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold')
        .text(t.invoiceHeader, bx + 4, by + 12, { width: bw - 8, align: 'center', characterSpacing: 2.5 });
    doc.moveTo(bx + 10, by + 30).lineTo(bx + bw - 10, by + 30)
        .lineWidth(0.3).strokeColor('#2A4D6E').stroke();
    doc.fillColor(C.white).fontSize(9.5).font('Helvetica')
        .text(invoice.invoice_number, bx + 4, by + 36, { width: bw - 8, align: 'center' });
    doc.fillColor('#A8C0D8').fontSize(7.5)
        .text(dateLoc(invoice.created_at), bx + 4, by + 53, { width: bw - 8, align: 'center' });

    doc.y = headerH + 18;

    // ── BLOCS INFO ───────────────────────────
    const cw = contentWidth(doc);
    const halfW = (cw - 12) / 2;
    const infoH = 122;
    const infoY = doc.y;  // capturer Y avant les deux blocs

    const billedToLabel = lang === 'en' ? 'BILLED TO' : 'FACTURÉ À';
    infoBox(doc, C.marginL, infoY, halfW, infoH, C.blueMid, billedToLabel, [
        [t.name, client.full_name],
        [t.company, client.company_name],
        [t.email, client.email],
        [t.phone, client.phone],
        [lang === 'en' ? 'Address' : 'Adresse', client.address],
        [t.city, `${client.city || ''}, ${client.province || ''} ${client.postal_code || ''}`.trim()],
    ]);

    // Bloc détails avec badge statut
    const rx = C.marginL + halfW + 12;
    infoBox(doc, rx, infoY, halfW, infoH, C.navy, lang === 'en' ? 'DETAILS' : 'DÉTAILS', [
        [t.quoteNumber, invoice.invoice_number],
        [t.invoiceIssued, dateLoc(invoice.created_at)],
        [t.invoiceDue, invoice.due_date ? dateLoc(invoice.due_date) : t.empty],
    ]);
    // Badge statut positionné dans le bloc droite
    const badgeBg = isPaid ? C.greenLight : C.amberLight;
    const badgeTxt = isPaid ? C.green : C.amber;
    const badgeLabel = isPaid
        ? (lang === 'en' ? 'PAID' : 'PAYÉE')
        : (lang === 'en' ? 'PENDING' : 'EN ATTENTE');
    statusBadge(doc, rx + halfW - 100, infoY + 72, badgeLabel, badgeBg, badgeTxt);

    doc.y = infoY + infoH + 18;

    // ── TABLEAU ──────────────────────────────
    sectionBar(doc, t.invoiceDescription, isPaid ? C.green : C.blue);
    serviceTable(doc, [{
        description: invoice.title + (invoice.description ? '\n' + invoice.description : ''),
        qty: 1, unit: t.unitDefault, amount_ht: invoice.amount_ht
    }], t);

    taxBlock(doc, invoice.amount_ht, invoice.tps_amount, invoice.tvq_amount, invoice.amount_ttc,
        lang === 'en' ? 'INVOICE TOTAL' : 'TOTAL FACTURE', t);

    // ── PAIEMENT — dynamique selon statut ────────────────────────────────
    sectionBar(doc, t.invoicePaymentInfo, isPaid ? C.green : C.blue);
    const payY = doc.y;

    if (isPaid) {
        // ── FACTURE PAYÉE : afficher le mode de paiement utilisé ──────────
        const paidByStripe = !!(invoice.stripe_payment_intent_id);
        const paidByCash = !paidByStripe && invoice.payment_method === 'comptant';
        const paidDate = invoice.paid_at ? dateLoc(invoice.paid_at) : dateLoc(new Date());

        const payH = 56;
        doc.rect(C.marginL, payY, cw, payH).fillColor('#F0FDF4').fill();
        doc.rect(C.marginL, payY, 3, payH).fillColor(C.green).fill();
        doc.rect(C.marginL, payY, cw, payH).lineWidth(0.5).strokeColor('#A7F3D0').stroke();

        // Icône checkmark
        doc.fillColor(C.green).fontSize(9).font('Helvetica-Bold')
            .text(lang === 'en' ? 'PAYMENT RECEIVED' : 'PAIEMENT REÇU', C.marginL + 12, payY + 10);
        doc.fillColor(C.gray).fontSize(8).font('Helvetica')
            .text(t.date + ' : ' + paidDate, C.marginL + 12, payY + 24);

        let modeLabel = lang === 'en' ? 'Bank transfer / Interac' : 'Virement bancaire / Interac';
        if (paidByStripe) modeLabel = lang === 'en' ? 'Credit card (secure online payment)' : 'Carte de crédit (paiement en ligne sécurisé)';
        else if (paidByCash) modeLabel = t.invoicePayCash;

        doc.fillColor(C.gray).fontSize(8)
            .text((lang === 'en' ? 'Method' : 'Mode') + ' : ' + modeLabel, C.marginL + 12, payY + 36);

        if (paidByStripe && invoice.stripe_payment_intent_id) {
            doc.fillColor('#94A3B8').fontSize(7)
                .text((lang === 'en' ? 'Stripe ref.' : 'Réf. Stripe') + ' : ' + invoice.stripe_payment_intent_id, C.marginL + 12, payY + 47, { width: cw - 24 });
        }
        doc.y = payY + payH + 8;

    } else {
        // ── FACTURE NON PAYÉE : afficher les deux modes disponibles ────────
        const payH = 80;
        doc.rect(C.marginL, payY, cw, payH).fillColor(C.grayLight).fill();
        doc.rect(C.marginL, payY, 3, payH).fillColor(C.blueMid).fill();
        doc.rect(C.marginL, payY, cw, payH).lineWidth(0.5).strokeColor(C.border).stroke();

        const colW = (cw - 16) / 2;
        const opt1Title = lang === 'en' ? 'OPTION 1 — ONLINE PAYMENT' : 'OPTION 1 — PAIEMENT EN LIGNE';
        const opt1Text1 = lang === 'en' ? 'Pay by credit card via your' : 'Payez par carte de crédit via votre';
        const opt1Text2 = lang === 'en' ? 'secure client portal:' : 'portail client sécurisé :';
        const opt2Title = lang === 'en' ? 'OPTION 2 — TRANSFER / INTERAC' : 'OPTION 2 — VIREMENT / INTERAC';
        const opt2Ref = lang === 'en' ? 'Mandatory reference:' : 'Référence obligatoire :';

        // Colonne gauche — carte en ligne
        const col1X = C.marginL + 8;
        doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
            .text(opt1Title, col1X, payY + 10, { width: colW - 8 });
        doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
            .text(opt1Text1, col1X, payY + 23, { width: colW - 8 });
        doc.fillColor(C.gray).fontSize(7.5)
            .text(opt1Text2, col1X, payY + 34, { width: colW - 8 });
        doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
            .text(C.site, col1X, payY + 45, { width: colW - 8 });
        doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
            .text(t.invoicePayStripe, col1X, payY + 58, { width: colW - 8 });

        // Séparateur
        const sepX = C.marginL + 8 + colW;
        doc.moveTo(sepX, payY + 8).lineTo(sepX, payY + 72)
            .lineWidth(0.5).strokeColor(C.border).stroke();

        // Colonne droite — virement
        const col2X = sepX + 8;
        doc.fillColor(C.blue).fontSize(7.5).font('Helvetica-Bold')
            .text(opt2Title, col2X, payY + 10, { width: colW - 8 });
        doc.fillColor(C.text).fontSize(7.5).font('Helvetica-Bold')
            .text(C.email, col2X, payY + 23, { width: colW - 8 });
        doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
            .text(opt2Ref, col2X, payY + 35, { width: colW - 8 });
        doc.fillColor(C.text).fontSize(8).font('Helvetica-Bold')
            .text(invoice.invoice_number, col2X, payY + 46, { width: colW - 8 });
        doc.fillColor('#94A3B8').fontSize(7)
            .text((lang === 'en' ? 'GST' : 'TPS') + ' : ' + C.tps + '  ·  ' + (lang === 'en' ? 'QST' : 'TVQ') + ' : ' + C.tvq, col2X, payY + 60, { width: colW - 8 });

        doc.y = payY + payH + 8;
    }

    // ── TAMPON PAYÉE ─────────────────────────
    if (isPaid) {
        doc.save()
            .rotate(-28, { origin: [w / 2, doc.page.height / 2] })
            .fontSize(80).fillColor(C.green).fillOpacity(0.06).font('Helvetica-Bold')
            .text(lang === 'en' ? 'PAID' : 'PAYÉE', 60, doc.page.height / 2 - 50, { width: w - 120, align: 'center' })
            .restore();
    }

    drawFooter(doc, invoice.invoice_number, C.navyDeep, t);
    doc.end();
}


// ─────────────────────────────────────────────
// HELPERS CONTRAT — mise en page multi-pages
// ─────────────────────────────────────────────

// Vérifie l'espace dispo et saute de page si nécessaire
function ensureSpace(doc, needed) {
    if (doc.y + needed > doc.page.height - 54) {
        doc.addPage();
        doc.y = 36;
    }
}

// Écrit un titre de section avec saut de page auto
function contractSection(doc, title, cw) {
    ensureSpace(doc, 40);
    const y = doc.y;
    doc.rect(C.marginL, y, cw, 20).fillColor(C.blue).fill();
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
        .text(title.toUpperCase(), C.marginL + 8, y + 6, { width: cw - 16, characterSpacing: 0.5 });
    doc.y = y + 26;
}

// Écrit un sous-titre
function contractSubtitle(doc, text, cw) {
    ensureSpace(doc, 24);
    doc.fillColor(C.blue).fontSize(8.5).font('Helvetica-Bold')
        .text(text, C.marginL, doc.y, { width: cw });
    doc.y += 13;
}

// Écrit un paragraphe avec saut de page auto
function contractPara(doc, text, cw, opts) {
    opts = opts || {};
    const indent = opts.indent || 0;
    const h = doc.heightOfString(text, { width: cw - indent, lineGap: 2 }) + 6;
    ensureSpace(doc, h);
    doc.fillColor(opts.color || C.text).fontSize(opts.size || 7.5).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(text, C.marginL + indent, doc.y, { width: cw - indent, lineGap: 2 });
    doc.y += h;
}

// Ligne de tableau
function tableRow(doc, cols, widths, isHeader, cw, y) {
    const rowH = 18;
    const bg = isHeader ? C.blue : C.grayLight;
    let x = C.marginL;
    doc.rect(C.marginL, y, cw, rowH).fillColor(bg).fill();
    doc.rect(C.marginL, y, cw, rowH).lineWidth(0.5).strokeColor(C.border).strokeOpacity(0.5).stroke();
    cols.forEach((col, i) => {
        doc.fillColor(isHeader ? C.white : C.text).fontSize(7.5)
            .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
            .text(col, x + 4, y + 5, { width: widths[i] - 8 });
        x += widths[i];
    });
    return y + rowH;
}

// Tableau complet avec header
function contractTable(doc, headers, rows, widths, cw) {
    ensureSpace(doc, (rows.length + 1) * 18 + 8);
    let y = doc.y;
    y = tableRow(doc, headers, widths, true, cw, y);
    rows.forEach((row, i) => {
        if (i % 2 === 1) {
            doc.rect(C.marginL, y, cw, 18).fillColor('#EEF4FB').fill();
            doc.rect(C.marginL, y, cw, 18).lineWidth(0.5).strokeColor(C.border).strokeOpacity(0.5).stroke();
            let x2 = C.marginL;
            row.forEach((col, j) => {
                doc.fillColor(C.text).fontSize(7.5).font('Helvetica')
                    .text(col, x2 + 4, y + 5, { width: widths[j] - 8 });
                x2 += widths[j];
            });
            y += 18;
        } else {
            y = tableRow(doc, row, widths, false, cw, y);
        }
    });
    doc.y = y + 8;
}

// Puce item
function bulletItem(doc, text, cw) {
    const h = doc.heightOfString(text, { width: cw - 14, lineGap: 2 }) + 5;
    ensureSpace(doc, h);
    doc.fillColor(C.blue).fontSize(8).font('Helvetica-Bold')
        .text('•', C.marginL, doc.y, { width: 10 });
    doc.fillColor(C.text).fontSize(7.5).font('Helvetica')
        .text(text, C.marginL + 12, doc.y - (doc.currentLineHeight() + 2), { width: cw - 14, lineGap: 2 });
    doc.y += h;
}

// Header de page répété (compact, pour pages suivantes)
function miniHeader(doc, contractNumber, pageNum) {
    const w = pageWidth(doc);
    doc.rect(0, 0, w, 28).fillColor(C.navy).fill();
    doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold')
        .text(C.name, C.marginL, 10, { width: w / 2 });
    doc.fillColor('#B8CDD8').fontSize(7).font('Helvetica')
        .text(`${contractNumber}  ·  Page ${pageNum}`, w / 2, 10, { width: w / 2 - C.marginR, align: 'right' });
    doc.y = 36;
}


// ─────────────────────────────────────────────
// TEMPLATE 3 — CONTRAT DE SERVICE COMPLET
// Contrat principal + Annexes A–D avec tarifs du site
// ─────────────────────────────────────────────
async function generateContractPDF(res, contract, client, quote, opts) {
    opts = opts || {};
    const lang = opts.lang === 'en' ? 'en' : 'fr';
    const t = getDict(lang);
    const ct = getContractText(lang);
    const dateLoc = (d) => dateForLang(d, lang);
    const fmtLoc = (v) => fmtForLang(v, lang);

    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.contract_number}.pdf"`);
    doc.pipe(res);

    const w = pageWidth(doc);
    const cw = contentWidth(doc);

    // ════════════════════════════════════════════
    // PAGE 1 — EN-TÊTE + PARTIES + OBJET
    // ════════════════════════════════════════════
    doc.rect(0, 0, w / 2, 88).fillColor(C.blue).fill();
    doc.rect(w / 2, 0, w / 2, 88).fillColor(C.navy).fill();
    doc.rect(0, 85, w, 3).fillColor(C.blueMid).fillOpacity(0.8).fill().fillOpacity(1);
    drawHexLogo(doc, w / 2, 44, 24, C.white, C.white);

    doc.fillColor(C.white).fontSize(11).font('Helvetica-Bold').text(C.name, 16, 18, { width: w / 2 - 36 });
    doc.fillColor('#B8CDD8').fontSize(7).font('Helvetica').text('VALUE · NETWORK · KNOWLEDGE', 16, 32, { characterSpacing: 0.8 });
    doc.fillColor('#B8CDD8').fontSize(6.5).text(`NEQ : ${C.neq}  ·  ${C.email}  ·  ${C.phone}`, 16, 43);
    doc.fillColor('#B8CDD8').fontSize(6.5).text(C.address, 16, 53);

    const subTitle = lang === 'en' ? 'INDUSTRIAL AUTOMATION' : 'EN AUTOMATISATION INDUSTRIELLE';
    const datedLabel = lang === 'en' ? 'Dated' : 'Daté du';
    doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold').text(t.contractHeader, w / 2 + 28, 16, { width: w / 2 - 46 });
    doc.fillColor(C.white).fontSize(8.5).font('Helvetica').text(subTitle, w / 2 + 28, 28, { width: w / 2 - 46 });
    doc.fillColor('#B8CDD8').fontSize(8).text(contract.contract_number, w / 2 + 28, 42, { width: w / 2 - 46 });
    doc.fillColor('#B8CDD8').fontSize(7.5).text(`${datedLabel} ${dateLoc(contract.created_at)}`, w / 2 + 28, 54, { width: w / 2 - 46 });

    doc.y = 100;

    // Blocs parties
    const halfW = (cw - 12) / 2;
    const infoH = 118;
    const infoY = doc.y;
    const labels = lang === 'en'
        ? { company: 'Company', represented: 'Represented by', address: 'Address' }
        : { company: 'Société', represented: 'Représenté', address: 'Adresse' };

    infoBox(doc, C.marginL, infoY, halfW, infoH, C.blue, t.provider, [
        [labels.company, C.name],
        ['NEQ', C.neq],
        [labels.represented, `${C.founder}, ${C.title}`],
        [labels.address, C.address],
        [t.email, C.email],
        [t.phone, C.phone],
    ]);
    infoBox(doc, C.marginL + halfW + 12, infoY, halfW, infoH, C.navy, t.client, [
        [t.name, client.full_name],
        [t.company, client.company_name || '—'],
        [labels.address, client.address || '—'],
        [t.city, `${client.city || ''}, ${client.province || 'QC'} ${client.postal_code || ''}`.trim()],
        [t.email, client.email],
        [t.phone, client.phone || '—'],
    ]);
    doc.y = infoY + infoH + 12;

    // Objet
    contractSection(doc, ct.section1Title, cw);
    contractPara(doc, ct.section1Intro, cw);
    ct.section1Bullets.forEach(b => bulletItem(doc, b, cw));
    contractPara(doc, ct.section1Outro, cw);
    doc.y += 4;

    if (contract.title) {
        contractSection(doc, ct.section2Title, cw);
        contractPara(doc, contract.title, cw, { bold: true });
        if (quote) contractPara(doc, ct.section2QuoteRef(quote.quote_number, fmtLoc(quote.amount_ttc)), cw, { color: C.gray });
        const serviceText = contract.content || (quote ? `${quote.description || ''}` : ct.section2Fallback);
        if (serviceText) contractPara(doc, serviceText, cw);
        doc.y += 4;
    }

    // ════════════════════════════════════════════
    // CONDITIONS GÉNÉRALES (clauses 3 à 23) — depuis CONTRACT_TEXT
    // ════════════════════════════════════════════
    const clauses = ct.clauses;

    clauses.forEach(([title, text]) => {
        const titleH = 14;
        const textH = doc.heightOfString(text, { width: cw - 12, lineGap: 2 }) + 8;
        ensureSpace(doc, titleH + textH);
        doc.fillColor(C.blue).fontSize(8).font('Helvetica-Bold')
            .text(title, C.marginL, doc.y, { width: cw });
        doc.y += 12;
        doc.fillColor(C.text).fontSize(7.5).font('Helvetica')
            .text(text, C.marginL + 8, doc.y, { width: cw - 8, lineGap: 2 });
        doc.y += textH;
    });

    // ════════════════════════════════════════════
    // SIGNATURES — toujours sur nouvelle page
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, ct.section24Title, cw);
    contractPara(doc, ct.section24Para(dateLoc(contract.created_at)), cw);
    doc.y += 12;

    const sigY = doc.y;
    const sigW = (cw - 16) / 2;
    const sigBoxH = 110; // plus haut pour accueillir l'image de signature

    // ── Bloc VNK (gauche) ──
    doc.rect(C.marginL, sigY, sigW, sigBoxH).fillColor(C.grayLight).fill();
    doc.rect(C.marginL, sigY, 3, sigBoxH).fillColor(C.blue).fill();
    doc.rect(C.marginL, sigY, sigW, sigBoxH).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.blue).fontSize(8).font('Helvetica-Bold').text('VNK AUTOMATISATION INC.', C.marginL + 10, sigY + 8);
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(C.founder, C.marginL + 10, sigY + 20)
        .text(C.title, C.marginL + 10, sigY + 30);

    // Image de signature admin si disponible
    if (contract.admin_signature_data && contract.admin_signature_data.startsWith('data:image/')) {
        try {
            const base64 = contract.admin_signature_data.replace(/^data:image\/\w+;base64,/, '');
            const imgBuf = Buffer.from(base64, 'base64');
            doc.image(imgBuf, C.marginL + 10, sigY + 40, { width: sigW - 20, height: 40, fit: [sigW - 20, 40] });
        } catch (e) { /* image corrompue — on laisse la ligne vide */ }
    }
    // Ligne de signature
    doc.moveTo(C.marginL + 10, sigY + 84).lineTo(C.marginL + sigW - 10, sigY + 84)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7).text(t.signature, C.marginL + 10, sigY + 87);

    // Date
    const adminSignedDate = contract.admin_signed_at ? dateLoc(contract.admin_signed_at) : '_______________';
    doc.moveTo(C.marginL + 10, sigY + 100).lineTo(C.marginL + sigW - 10, sigY + 100)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7)
        .text(t.date + ' : ' + adminSignedDate, C.marginL + 10, sigY + 103);

    // ── Bloc Client (droite) ──
    const cx2 = C.marginL + sigW + 16;
    doc.rect(cx2, sigY, sigW, sigBoxH).fillColor(C.grayLight).fill();
    doc.rect(cx2, sigY, 3, sigBoxH).fillColor(C.navy).fill();
    doc.rect(cx2, sigY, sigW, sigBoxH).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.navy).fontSize(8).font('Helvetica-Bold')
        .text((client.company_name || client.full_name || '').toUpperCase(), cx2 + 10, sigY + 8, { width: sigW - 20 });
    doc.fillColor(C.gray).fontSize(7.5).font('Helvetica')
        .text(client.full_name || '', cx2 + 10, sigY + 20);

    // Image de signature client si disponible
    if (contract.client_signature_data && contract.client_signature_data.startsWith('data:image/')) {
        try {
            const base64 = contract.client_signature_data.replace(/^data:image\/\w+;base64,/, '');
            const imgBuf = Buffer.from(base64, 'base64');
            doc.image(imgBuf, cx2 + 10, sigY + 40, { width: sigW - 20, height: 40, fit: [sigW - 20, 40] });
        } catch (e) { /* image corrompue */ }
    }
    // Ligne de signature
    doc.moveTo(cx2 + 10, sigY + 84).lineTo(cx2 + sigW - 10, sigY + 84)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7).text(t.signature, cx2 + 10, sigY + 87);

    // Date + IP
    const clientSignedDate = contract.signed_at ? dateLoc(contract.signed_at) : '_______________';
    const ipStr = contract.client_signature_ip ? '  ·  IP : ' + contract.client_signature_ip : '';
    doc.moveTo(cx2 + 10, sigY + 100).lineTo(cx2 + sigW - 10, sigY + 100)
        .lineWidth(0.5).strokeColor(C.border).stroke();
    doc.fillColor(C.gray).fontSize(7)
        .text(t.date + ' : ' + clientSignedDate + ipStr, cx2 + 10, sigY + 103, { width: sigW - 20 });

    doc.y = sigY + sigBoxH + 16;

    // Table annexes
    contractPara(doc, ct.annexesIntro, cw, { color: C.gray });
    doc.y += 4;
    contractTable(doc, [t.contractAnnex, t.contractAnnexDesc], ct.annexesTable, [cw * 0.2, cw * 0.8], cw);

    drawFooter(doc, contract.contract_number, C.navy, t);

    // ════════════════════════════════════════════
    // ANNEXE A — SLA
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, ct.annexA.title, cw);
    contractPara(doc, ct.annexA.intro, cw);
    doc.y += 6;

    contractSubtitle(doc, ct.annexA.coverageTitle, cw);
    ct.annexA.coverageItems.forEach(item => bulletItem(doc, item, cw));
    doc.y += 6;

    contractSubtitle(doc, ct.annexA.slaLevelsTitle, cw);
    contractTable(doc, ct.annexA.slaLevelsHeaders, ct.annexA.slaLevelsRows,
        [cw * 0.18, cw * 0.26, cw * 0.28, cw * 0.28], cw);
    doc.y += 4;

    contractSubtitle(doc, ct.annexA.classifTitle, cw);
    contractTable(doc, ct.annexA.classifHeaders, ct.annexA.classifRows,
        [cw * 0.18, cw * 0.44, cw * 0.38], cw);
    doc.y += 4;

    contractSubtitle(doc, ct.annexA.exclusionsTitle, cw);
    ct.annexA.exclusionsItems.forEach(item => bulletItem(doc, item, cw));

    drawFooter(doc, contract.contract_number + ' — ' + t.contractAnnex + ' A', C.navy, t);

    // ════════════════════════════════════════════
    // ANNEXE B — SUPPORT MENSUEL
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, ct.annexB.title, cw);
    contractPara(doc, ct.annexB.intro, cw);
    doc.y += 6;

    contractSubtitle(doc, ct.annexB.plansTitle, cw);
    contractTable(doc, ct.annexB.plansHeaders, ct.annexB.plansRows,
        [cw * 0.22, cw * 0.22, cw * 0.26, cw * 0.30], cw);
    contractPara(doc, ct.annexB.plansNote, cw, { color: C.gray });
    doc.y += 6;

    contractSubtitle(doc, ct.annexB.durationTitle, cw);
    contractPara(doc, ct.annexB.durationPara, cw);
    doc.y += 6;

    contractSubtitle(doc, ct.annexB.specialTitle, cw);
    ct.annexB.specialItems.forEach(item => bulletItem(doc, item, cw));

    drawFooter(doc, contract.contract_number + ' — ' + t.contractAnnex + ' B', C.navy, t);

    // ════════════════════════════════════════════
    // ANNEXE C — GRILLE TARIFAIRE
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, ct.annexC.title, cw);
    contractPara(doc, ct.annexC.intro(dateLoc(new Date())), cw, { color: C.gray });
    doc.y += 6;

    contractSubtitle(doc, ct.annexC.techTitle, cw);
    contractTable(doc, ct.annexC.techHeaders, ct.annexC.techRows, [cw * 0.62, cw * 0.38], cw);
    doc.y += 4;

    contractSubtitle(doc, ct.annexC.auditTitle, cw);
    contractTable(doc, ct.annexC.auditHeaders, ct.annexC.auditRows, [cw * 0.28, cw * 0.28, cw * 0.44], cw);
    doc.y += 4;

    contractSubtitle(doc, ct.annexC.docTitle, cw);
    contractTable(doc, ct.annexC.docHeaders, ct.annexC.docRows, [cw * 0.28, cw * 0.28, cw * 0.44], cw);
    doc.y += 4;

    contractSubtitle(doc, ct.annexC.refacTitle, cw);
    contractTable(doc, ct.annexC.refacHeaders, ct.annexC.refacRows, [cw * 0.30, cw * 0.30, cw * 0.40], cw);
    doc.y += 4;

    contractSubtitle(doc, ct.annexC.extraTitle, cw);
    contractTable(doc, ct.annexC.extraHeaders, ct.annexC.extraRows, [cw * 0.55, cw * 0.45], cw);

    drawFooter(doc, contract.contract_number + ' — ' + t.contractAnnex + ' C', C.navy, t);

    // ════════════════════════════════════════════
    // ANNEXE D — RESSOURCES TECHNIQUES
    // ════════════════════════════════════════════
    doc.addPage();
    doc.y = 36;

    contractSection(doc, ct.annexD.title, cw);
    contractPara(doc, ct.annexD.intro, cw);
    doc.y += 6;

    contractSubtitle(doc, ct.annexD.typesTitle, cw);
    ct.annexD.typesItems.forEach(item => bulletItem(doc, item, cw));
    doc.y += 6;

    contractSubtitle(doc, ct.annexD.ratesTitle, cw);
    contractTable(doc, ct.annexD.ratesHeaders, ct.annexD.ratesRows, [cw * 0.55, cw * 0.45], cw);
    contractPara(doc, ct.annexD.ratesNote, cw, { color: C.gray });
    doc.y += 6;

    contractSubtitle(doc, ct.annexD.modalitiesTitle, cw);
    ct.annexD.modalitiesItems.forEach(item => bulletItem(doc, item, cw));
    doc.y += 6;

    contractSubtitle(doc, ct.annexD.nonSolicitTitle, cw);
    contractPara(doc, ct.annexD.nonSolicitPara, cw);
    doc.y += 6;

    contractSubtitle(doc, ct.annexD.terminationTitle, cw);
    contractPara(doc, ct.annexD.terminationPara, cw);

    drawFooter(doc, contract.contract_number + ' — ' + t.contractAnnex + ' D', C.navy, t);

    // Numéros de page sur toutes les pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.fillColor('#94A3B8').fontSize(6.5).font('Helvetica')
            .text(`Page ${i + 1} / ${range.count}`, C.marginL, doc.page.height - 10, { width: cw, align: 'right' });
    }

    doc.end();
}

// ─────────────────────────────────────────────
// FLUX AUTO : Devis accepté → Contrat en DB
// ─────────────────────────────────────────────
async function autoGenerateContract(pool, quoteId) {
    const quoteRes = await pool.query(
        `SELECT q.*, c.full_name, c.email, c.phone, c.company_name, c.address, c.city, c.province
         FROM quotes q JOIN clients c ON q.client_id = c.id WHERE q.id = $1`,
        [quoteId]
    );
    if (!quoteRes.rows.length) throw new Error('Devis non trouvé');
    const quote = quoteRes.rows[0];

    const year = new Date().getFullYear();
    const count = await pool.query(
        'SELECT COUNT(*) FROM contracts WHERE EXTRACT(YEAR FROM created_at)=$1', [year]
    );
    const num = `CT-${year}-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;

    const contractTitle = `Contrat de service — ${quote.title}`;
    const contractContent = `Services d'automatisation industrielle conformément au devis ${quote.quote_number}.\n\n${quote.description || ''}`;

    const contractRes = await pool.query(
        `INSERT INTO contracts (client_id, quote_id, contract_number, title, content, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), NOW()) RETURNING *`,
        [quote.client_id, quoteId, num, contractTitle, contractContent]
    );

    return { contract: contractRes.rows[0], quote, client: quote };
}


// ─────────────────────────────────────────────
// TEMPLATE 4 — REÇU DE PAIEMENT (1 page, simple, post-paiement Stripe)
// ─────────────────────────────────────────────
async function generateReceiptPDF(res, receipt, client, opts) {
    opts = opts || {};
    const lang = opts.lang === 'en' ? 'en' : 'fr';
    const t = getDict(lang);
    const dateLoc = (d) => dateForLang(d, lang);
    const fmtLoc = (v) => fmtForLang(v, lang);
    const L = lang === 'en'
        ? { receipt: 'RECEIPT', paidOn: 'Paid on', reference: 'Reference',
            method: 'Method', amount: 'Amount', invoice: 'Invoice',
            thanks: 'Thank you for your business.',
            keepRecord: 'Please keep this receipt for your records.',
            stripeFooter: 'Secure payment processed via Stripe',
            number: 'Receipt no.' }
        : { receipt: 'REÇU', paidOn: 'Payé le', reference: 'Référence',
            method: 'Méthode', amount: 'Montant', invoice: 'Facture',
            thanks: 'Merci de votre confiance.',
            keepRecord: 'Veuillez conserver ce reçu pour vos archives.',
            stripeFooter: 'Paiement sécurisé traité via Stripe',
            number: 'Reçu n°' };

    const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${receipt.invoice_number || receipt.id}.pdf"`);
    doc.pipe(res);

    const w = pageWidth(doc);
    const cw = contentWidth(doc);

    // Header navy avec badge "REÇU"
    const headerH = 100;
    doc.rect(0, 0, w, headerH).fillColor(C.green).fill();
    doc.rect(0, headerH - 4, w, 4).fillColor('#15803D').fillOpacity(0.6).fill().fillOpacity(1);

    drawHexLogo(doc, 56, 50, 30, C.white, C.white);

    doc.fillColor(C.white).fontSize(14).font('Helvetica-Bold').text(C.name, 100, 22);
    doc.fillColor('rgba(255,255,255,0.85)').fontSize(7).font('Helvetica')
        .text('VALUE · NETWORK · KNOWLEDGE', 100, 41, { characterSpacing: 1.5 });
    doc.fillColor('#D1FAE5').fontSize(6.5).text(`${C.email}  ·  ${C.phone}`, 100, 54);

    // Badge "REÇU" / "RECEIPT"
    const bx = w - 150, by = 18, bw = 124, bh = 64;
    doc.rect(bx, by, bw, bh).fillColor('#15803D').fill();
    doc.rect(bx, by, 3, bh).fillColor('#86EFAC').fill();
    doc.fillColor(C.white).fontSize(12).font('Helvetica-Bold')
        .text(L.receipt, bx, by + 14, { width: bw, align: 'center', characterSpacing: 3 });
    doc.fillColor('#D1FAE5').fontSize(7.5).font('Helvetica')
        .text(`${L.number} ${receipt.receipt_number || ('R-' + (receipt.id ?? '00000'))}`, bx, by + 36, { width: bw, align: 'center' });
    doc.fillColor('#86EFAC').fontSize(7)
        .text(dateLoc(receipt.paid_at ?? new Date()), bx, by + 50, { width: bw, align: 'center' });

    doc.y = headerH + 28;

    // Bloc client + sommaire
    const halfW = (cw - 12) / 2;
    const infoY = doc.y;
    infoBox(doc, C.marginL, infoY, halfW, 100, C.green, t.client, [
        [t.name, client.full_name],
        [t.company, client.company_name],
        [t.email, client.email],
    ]);

    // Sommaire paiement
    const rx = C.marginL + halfW + 12;
    doc.rect(rx, infoY, halfW, 100).fillColor(C.grayLight).fill();
    doc.rect(rx, infoY, halfW, 100).lineWidth(0.5).strokeColor(C.border).stroke();
    doc.rect(rx, infoY, 3, 100).fillColor(C.green).fill();
    doc.fillColor(C.green).font('Helvetica-Bold').fontSize(8)
        .text(L.amount.toUpperCase(), rx + 12, infoY + 12, { characterSpacing: 0.6 });
    doc.fillColor(C.green).font('Helvetica-Bold').fontSize(24)
        .text(fmtLoc(receipt.amount), rx + 12, infoY + 26, { width: halfW - 24 });
    doc.fillColor(C.gray).font('Helvetica').fontSize(7.5)
        .text(L.paidOn + ' : ' + dateLoc(receipt.paid_at ?? new Date()), rx + 12, infoY + 62);
    doc.text(L.method + ' : ' + (receipt.payment_method || 'Stripe'), rx + 12, infoY + 76);

    doc.y = infoY + 116;

    // Détails facture liée
    if (receipt.invoice_number) {
        sectionBar(doc, lang === 'en' ? 'Linked invoice' : 'Facture liée');
        doc.fillColor(C.text).font('Helvetica-Bold').fontSize(10)
            .text(receipt.invoice_number, C.marginL, doc.y);
        if (receipt.invoice_title) {
            doc.fillColor(C.gray).font('Helvetica').fontSize(8.5)
                .text(receipt.invoice_title, C.marginL, doc.y + 2, { width: cw });
        }
        doc.moveDown(0.5);
    }

    // Reference Stripe si applicable
    if (receipt.stripe_payment_intent_id) {
        doc.moveDown(0.5);
        doc.fillColor(C.gray).font('Helvetica').fontSize(7.5)
            .text(L.reference + ' Stripe : ' + receipt.stripe_payment_intent_id, C.marginL, doc.y);
    }

    // Message remerciement
    doc.moveDown(2);
    doc.fillColor(C.green).font('Helvetica-Bold').fontSize(11)
        .text(L.thanks, C.marginL, doc.y, { width: cw, align: 'center' });
    doc.moveDown(0.3);
    doc.fillColor(C.gray).font('Helvetica').fontSize(8)
        .text(L.keepRecord, C.marginL, doc.y, { width: cw, align: 'center' });

    // Footer note Stripe
    if (receipt.stripe_payment_intent_id) {
        doc.moveDown(2);
        doc.rect(C.marginL, doc.y, cw, 26).fillColor('#F0FDF4').fill();
        doc.rect(C.marginL, doc.y, 3, 26).fillColor(C.green).fill();
        doc.fillColor(C.green).font('Helvetica-Bold').fontSize(8)
            .text(L.stripeFooter, C.marginL + 10, doc.y + 8, { width: cw - 20 });
    }

    drawFooter(doc, receipt.receipt_number || ('R-' + (receipt.id ?? '00000')), C.navy, t);
    doc.end();
}

module.exports = {
    generateQuotePDF,
    generateInvoicePDF,
    generateContractPDF,
    generateReceiptPDF,
    autoGenerateContract,
    fmt
};