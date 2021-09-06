const R = require('ramda')

const messages = {
    'Αγγλικά': {
        'ΝΑΙ': 'YES',
        'NAI': 'YES',
        'ΌΧΙ': 'NO',
        'ΟΧΙ': 'NO',
        'ΣΥΓΚΕΝΤΡΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΔΑΠΑΝΩΝ': 'TOTALS EXPENSE TABLE',
        'Κατηγορία Δαπάνης': 'Expense Category',
        'Συνολικό Κόστος(€)': 'Total Budget(€)',
        'Μη Επιλέξιμο Κόστος(€)': 'Non Eligible Budget(€)',
        'Επιλέξιμο Κόστος(€)': 'Eligible Budget(€)',
        'Δημόσια Δαπάνη (€)': 'Public Expenditure (€)',
        'Συνολικά': 'Total',
        'Με τη συγχρηματοδότηση της Ελλάδας και της Ευρωπαϊκής Ένωσης': 'Co-funded by the European Union (ERDF) and National Funds',
        'Κωδικός πράξης': 'Code',
        'Ημερομηνία Οριστικοποίησης': 'Finalisation Date',
        'σελ.': 'page',
        'από': 'from',
        'Ημερομηνία': 'Date',
        'Υπογραφή': 'Signature',
        'Σφραγίδα': 'Stamp',
        'Δικαιούχος': 'Beneficiary',
		'Δικαιούχοι': 'Beneficiaries',
        'Μη Οριστικοποιημένη': 'Not Finalised',
        'Φόρμα Υποβολής': 'Submission Form',
        'Αξιολόγηση': 'First level evaluation',
        'Γνωμοδοτική Επιτροπή':'Second Level Evaluation (Joint Assessment Team)',
        'Αίτηση Ένστασης':'Complaint Application',
        'Αξιολόγησης Ένστασης': 'Evaluation of Complaint',
        'Αίτημα Προκαταβολής': 'Advance Payment Claim',
        'Αξιολόγηση Προκαταβολής': 'Evaluation of the Advance Payment Claim',
        'Εκταμίευση Προκαταβολής': 'Disbursement of the Advance Payment',
        'Αίτημα Τροποποίησης': 'Request for Modification',
        'Αξιολόγηση Αιτήματος Τροποποίησης': 'Evaluation Report of the Request for Modification',
        'Γενικά Στοιχεία Δικαιούχου': 'Beneficiary General Information',
        'Στοιχεία Εκπροσώπων': 'Legal Representative Information',
        'Στοιχεία Εταίρων/Μετόχων': 'Beneficiary Enterprise Partner / Shareholder Information',
        'Κ.Α.Δ. Δικαιούχου/Επένδυσης': 'Beneficiary/Investment NACE Code',
        'Στοιχεία Επένδυσης': 'Investment Plan Identity',
        'Τόπος Υλοποίησης': 'Location of Investment',
        'Φυσικό Αντικείμενο': 'INVESTMENT PLAN IDENTITY',
        'Πίνακας Δαπανών': 'Table of Expenditures',
        'Χρηματοδοτικό Σχήμα': 'Financing Scheme',
        'Αίτημα ελέγχου': 'Verification & Certification Request',
        'Έλεγχος δαπανών βάσει Ισχύοντος Τεχνικού Παραρτήματος - Συγκεντρωτικά' : 'Check of expenditures according to the AF in force',
        'Προϋπολογισμός Βάσει Ένταξης': 'Approved Budget',
        'Προϋπολογισμός Βάσει Παραστατικών': 'Budget according to the invoices',
        'Συνολικό (€)': 'Total amount (€)',
        'Επιλέξιμο (€)': 'Eligible amount (€)',
        'Ποσοστό Δημόσιας Δαπάνης (%)': 'Percentage of Public Expenditure (%)',
        'Έκθεση Επαλήθευσης (Ελέγχου)': 'Verification Report',
		'Έκθεση πιστοποίησης': 'Validation of Verification Report',
        'Καταβολή Ενίσχυσης (Εκταμίευση)': 'Payment Amount (Disbursement)'
    }    
}

const getTranslation = function getTranslation (lang, msg) {
    return R.path([lang, msg], messages) || msg
}

module.exports = {getTranslation}