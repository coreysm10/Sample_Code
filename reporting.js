const fs = require('fs')
const file = fs.readFileSync('./tallitax_categories_mod.json')
const mapFile = fs.readFileSync('./tallitax_category_map_mod.json')
const usTaxFile = fs.readFileSync('./ZipReduced.json')
const tallitaxCategories = JSON.parse(file)
const taxCategoryHash = JSON.parse(mapFile)
const usTaxData = JSON.parse(usTaxFile)
const taxEligibleCategories = tallitaxCategories.filter(
  cat => cat.SalesTaxEligible === 1 ||
  cat.IsMedicalEligible === 1 ||
  cat.isNonProfitEligible === 1 ||
  cat.isChildCareEligible === 1 ||
  cat.IsEducation === 1 ||
  cat.IsTaxCredit === 1
)

const getGenericCategoryName = transactionCategoryId => {
  switch (taxCategoryHash[transactionCategoryId].generic_category) {
    
    case 2:
      return 'Medical expenses'
    case 3:
      return 'Charitable contributions'
    case 4:
      return 'Education expenses'
    case 5:
      return 'Childcare expenses'
    case 1:
      return 'Sales tax expenses'
    default:
      return 'totalDeductibleAmount'
  }
}


const getTaxCategory = (transactionCategoryId) => {
  return taxCategoryHash[transactionCategoryId].hierarchy__003 || 
  taxCategoryHash[transactionCategoryId].hierarchy__002 ||
  taxCategoryHash[transactionCategoryId].hierarchy__001
}

const getSalesTaxDeductionRate = (transactionCategoryId) => {
  return +taxCategoryHash[transactionCategoryId].SalesTaxPercentageApplied
}

//const getEstimatedCombinedRate = zipcode => +usTaxData[zipcode].combinedRate

const taxEligibleCategoryIds = taxEligibleCategories.map(cat => cat.category_id.toString())


const generateReport = (transactions, userZipcode, saveTransactions=true) => {
  let transactionList = []
  const report = {
    'totalDeductibleAmount': 0,
    'Sales tax expenses': 0,
    'Medical expenses': 0,
    'Charitable contributions': 0,
    'Education expenses': 0,
    'Childcare expenses': 0
  }
  transactions.forEach(t => {
    if (taxEligibleCategoryIds.includes(t.category_id)) {
      let deduction, deductionRate, salesTaxDeduction, onlineTransaction,taxableAmount, salesTaxRate, categoryName, reportZip;
      onlineTransaction = t.payment_channel === 'online'
      salesTaxDeduction = (taxCategoryHash[t.category_id].SalesTaxEligible === 1 && taxCategoryHash[t.category_id].generic_category === 1) ? true : false
      taxableAmount = getSalesTaxDeductionRate(t.category_id) 

      /*reportZip*/
      if ((t.location && t.location.postal_code) && !t.online) {
        reportZip = (t.location.postal_code)
      } else if (userZipcode){
        reportZip = userZipcode
      } else {
        reportZip = '03087'
      }
/*reduces zipcodes with leading 0s to match with file*/
      if (reportZip.substr(0, 2) =='00')  {
        zipNew = reportZip.substr(2)
        } else if (reportZip.substr(0, 1) =='0')  {
            zipNew = reportZip.substr(1)   
        } else {
         zipNew = reportZip
        }
     //   console.log(zipNew)
     //   console.log()
      salesTaxRate = usTaxData[zipNew].combinedRate
      /*salesTaxRate*/ 

      if (saveTransactions) {
        const transaction = {
          category: taxCategoryHash[t.category_id].generic_category,
          categoryName: getGenericCategoryName(t.category_id),
          plaidCategory: t.category_id,
          plaidCategoryName: t.category[0],
          online: onlineTransaction,
          name: t.name,
          merchant: t.merchant_name,
          date: t.date,
          amount: t.amount,
          zipcode: reportZip,
          /*Need to switch online vs user zip*/
          salesTaxRate: salesTaxRate,
          taxableAmount: taxableAmount 
        }
        if (salesTaxDeduction) {

            deduction = +parseFloat(t.amount *taxableAmount * salesTaxRate).toFixed(2)

        } else {
          deduction = +parseFloat(t.amount).toFixed(2)
        }
        transaction.deduction = deduction
        transactionList.push(transaction)
      }
      report[getGenericCategoryName(t.category_id)] += deduction
      report.totalDeductibleAmount += deduction
    }
  })
  report.totalDeductibleAmount = +parseFloat(report.totalDeductibleAmount).toFixed(2)
  report.transactions = transactionList
  return report
}

module.exports = { generateReport, tallitaxCategories, taxEligibleCategories }