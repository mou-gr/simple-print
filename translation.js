const R = require('ramda')

const messages = {
    'Αγγλικά': {
        'ΝΑΙ': 'YES',
        'ΌΧΙ': 'NO',
        'ΟΧΙ': 'NO',
        'ΣΥΓΚΕΝΤΡΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΔΑΠΑΝΩΝ': 'TOTALS EXPENSE TABLE',
        'Κατηγορία Δαπάνης': 'Expense Category',
        'Συνολικό Κόστος(€)': 'Total Budget(€)',
        'Μη Επιλέξιμο Κόστος(€)': 'Non Eligible Budget(€)',
        'Επιλέξιμο Κόστος(€)': 'Eligible Budget(€)',
        'Δημόσια Δαπάνη (€)': 'Public Expenditure(€)',
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
        'Μη Οριστικοποιημένη': 'Not Finalised',
        'Φόρμα Υποβολής': 'Submission Form',
        'Αξιολόγηση': 'Evaluation',
        'Γνωμοδοτική Επιτροπή':'Joint assessment team'
    }    
}

const getTranslation = function getTranslation (lang, msg) {
    return R.path([lang, msg], messages) || msg
}

module.exports = {getTranslation}