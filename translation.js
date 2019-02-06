const R = require('ramda')

const messages = {
    'Αγγλικά': {
        'ΝΑΙ': 'YES',
        'ΌΧΙ': 'NO',
        'ΣΥΓΚΕΝΤΡΩΤΙΚΟΣ ΠΙΝΑΚΑΣ ΔΑΠΑΝΩΝ': 'TOTALS EXPENSE TABLE',
        'Κατηγορία Δαπάνης': 'Expense Category',
        'Συνολικό Κόστος(€)': 'Total Budget(€)',
        'Μη Επιλέξιμο Κόστος(€)': 'Non Eligible Budget(€)',
        'Επιλέξιμο Κόστος(€)': 'Eligible Budget(€)',
        'Δημόσια Δαπάνη (€)': 'Public Expenditure(€)',
        'Συνολικά': 'Total',
        'Με τη συγχρηματοδότηση της Ελλάδας και της Ευρωπαϊκής Ένωσης': 'Co-Funded by Greece and the EU',
        'Κωδικός πράξης': 'Code',
        'Ημερομηνία Οριστικοποίησης': 'Finalisation Date',
        'σελ.': 'page',
        'από': 'from',
        'Ημερομηνία': 'Date',
        'Υπογραφή': 'Signature',
        'Σφραγίδα': 'Stamp',
        'Δικαιούχος': 'Beneficiary',
        'Μη Οριστικοποιημένη': 'Not Finalised'
    }    
}

const getTranslation = function getTranslation (lang, msg) {
    return R.path([lang, msg], messages) || msg
}

module.exports = {getTranslation}