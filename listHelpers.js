/**
 * function to get data to show from list of objects
 * @datsaource = list of objects
 * @key = key in object which is to be checked
 * @value = value of key which is to be compared
 * @label = field to show from object which will be returned
 */

export const getLabelFromListOfObjects = (datasource, key, value, label) => {
  let temp = '';

  for (let i = 0; i < datasource.length; i++) {
    if (datasource[i][key] == value) {
      temp = datasource[i][label];
      break;
    }
  }
  return temp;
};

export const checkValueInListOfObject = (datasource, key, value) => {
  for (let i = 0; i < datasource.length; i++) {
    if (datasource[i][key] == value) {
      return datasource[i].feature_status
      break;
    }
  }
  return false;
} 
