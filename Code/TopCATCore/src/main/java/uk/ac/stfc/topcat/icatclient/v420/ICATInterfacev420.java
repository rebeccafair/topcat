/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package uk.ac.stfc.topcat.icatclient.v420;

import java.net.MalformedURLException;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;

import javax.xml.namespace.QName;

import uk.ac.stfc.topcat.core.exception.AuthenticationException;
import uk.ac.stfc.topcat.core.exception.ICATMethodNotFoundException;
import uk.ac.stfc.topcat.core.gwt.module.TAdvancedSearchDetails;
import uk.ac.stfc.topcat.core.gwt.module.TConstants;
import uk.ac.stfc.topcat.core.gwt.module.TDatafile;
import uk.ac.stfc.topcat.core.gwt.module.TDatafileParameter;
import uk.ac.stfc.topcat.core.gwt.module.TDataset;
import uk.ac.stfc.topcat.core.gwt.module.TDatasetParameter;
import uk.ac.stfc.topcat.core.gwt.module.TFacilityCycle;
import uk.ac.stfc.topcat.core.gwt.module.TInvestigation;
import uk.ac.stfc.topcat.core.gwt.module.TInvestigator;
import uk.ac.stfc.topcat.core.gwt.module.TParameter;
import uk.ac.stfc.topcat.core.gwt.module.TPublication;
import uk.ac.stfc.topcat.core.gwt.module.TShift;
import uk.ac.stfc.topcat.core.gwt.module.TopcatException;
import uk.ac.stfc.topcat.core.gwt.module.TopcatExceptionType;
import uk.ac.stfc.topcat.core.icat.ICATWebInterfaceBase;
import uk.ac.stfc.topcat.icatclient.v420.Login.Credentials;
import uk.ac.stfc.topcat.icatclient.v420.Login.Credentials.Entry;

/**
 * 
 */
public class ICATInterfacev420 extends ICATWebInterfaceBase {
    private ICAT service;
    private String serverName;

    public ICATInterfacev420(String serverURL, String serverName) throws MalformedURLException {
        service = new ICATService(new URL(serverURL), new QName("http://icatproject.org", "ICATService")).getICATPort();
        this.serverName = serverName;
    }

    @Override
    public String loginLifetime(String authenticationType, Map<String, String> parameters, int hours)
            throws AuthenticationException {
        String result = new String();
        try {
            // TODO no longer uses hours
            Credentials credentials = new Credentials();
            List<Entry> entries = credentials.getEntry();
            for (String key : parameters.keySet()) {
                Entry entry = new Entry();
                entry.setKey(key);
                entry.setValue(parameters.get(key));
                entries.add(entry);
            }
            result = service.login(authenticationType, credentials);
        } catch (IcatException_Exception ex) {
            // TODO check type
            throw new AuthenticationException("ICAT Server not available");
        } catch (javax.xml.ws.WebServiceException ex) {
            throw new AuthenticationException("ICAT Server not available");
        }
        return result;
    }

    @Override
    public void logout(String sessionId) throws AuthenticationException {
        try {
            service.logout(sessionId);
        } catch (IcatException_Exception e) {
            // TODO check type
            throw new AuthenticationException("ICAT Server not available");
        } catch (javax.xml.ws.WebServiceException ex) {
            throw new AuthenticationException("ICAT Server not available");
        }
    }

    @Override
    public Boolean isSessionValid(String sessionId) {
        try {
            return new Boolean(service.getRemainingMinutes(sessionId) > 0);
        } catch (javax.xml.ws.WebServiceException ex) {
        } catch (IcatException_Exception e) {
            IcatException ue = e.getFaultInfo();
            if (ue.getType().equals(IcatExceptionType.SESSION)) {
                return Boolean.FALSE;
            } else {
                // TODO handle other types
            }
        }
        return Boolean.FALSE;
    }

    @Override
    public String getUserSurname(String sessionId, String userId) {
        String name;
        try {
            name = service.getUserName(sessionId);
        } catch (IcatException_Exception e) {
            return userId;
        }
        return name;
    }

    @Override
    public String getUserName(String sessionId) throws TopcatException {
        String name = "";
        try {
            name = service.getUserName(sessionId);
        } catch (IcatException_Exception e) {
            convertToTopcatException(e);
        }
        return name;
    }

    @Override
    public ArrayList<String> listInstruments(String sessionId) {
        return searchList(sessionId, "DISTINCT Instrument.name");
    }

    @Override
    public ArrayList<String> listInvestigationTypes(String sessionId) {
        return searchList(sessionId, "DISTINCT InvestigationType.name");
    }

    @Override
    public ArrayList<TFacilityCycle> listFacilityCycles(String sessionId) throws ICATMethodNotFoundException {
        ArrayList<TFacilityCycle> facilityCycles = new ArrayList<TFacilityCycle>();
        try {
            List<Object> resultCycle = service.search(sessionId, "FacilityCycle");
            for (Object fc : resultCycle) {
                facilityCycles.add(copyFacilityCycleToTFacilityCycle((FacilityCycle) fc));
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
        }
        return facilityCycles;
    }

    @Override
    public ArrayList<TFacilityCycle> listFacilityCyclesForInstrument(String sessionId, String instrument)
            throws ICATMethodNotFoundException {
        ArrayList<TFacilityCycle> facilityCycles = new ArrayList<TFacilityCycle>();
        try {
            List<Object> resultCycle = service.search(sessionId,
                    "FacilityCycle <-> Investigation <-> Instrument[name='" + instrument + "'] ");
            for (Object fc : resultCycle) {
                facilityCycles.add(copyFacilityCycleToTFacilityCycle((FacilityCycle) fc));
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
        }
        return facilityCycles;
    }

    private TFacilityCycle copyFacilityCycleToTFacilityCycle(FacilityCycle fc) {
        Date start = new Date();
        Date end = new Date();
        if (fc.getStartDate() != null)
            start = fc.getStartDate().toGregorianCalendar().getTime();
        if (fc.getEndDate() != null)
            end = fc.getEndDate().toGregorianCalendar().getTime();
        return new TFacilityCycle(fc.getDescription(), ((FacilityCycle) fc).getName(), start, end);
    }

    @Override
    public ArrayList<TInvestigation> getMyInvestigations(String sessionId) {
        ArrayList<TInvestigation> investigationList = new ArrayList<TInvestigation>();
        try {
            String name = service.getUserName(sessionId);
            List<Object> resultInv = service.search(sessionId, "Investigation <-> InvestigationUser <-> User[name='"
                    + name + "']");
            for (Object inv : resultInv) {
                investigationList.add(copyInvestigationToTInvestigation(serverName, (Investigation) inv));
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
        }
        Collections.sort(investigationList);
        return investigationList;
    }

    @Override
    public TInvestigation getInvestigationDetails(String sessionId, Long investigationId)
            throws AuthenticationException {
        TInvestigation ti = new TInvestigation();
        try {
            Investigation resultInv = (Investigation) service
                    .get(sessionId,
                            "Investigation INCLUDE Publication, InvestigationUser, Instrument, User, Shift, InvestigationParameter, ParameterType",
                            investigationId);
            ti = copyInvestigationToTInvestigation(serverName, resultInv);

            if (resultInv.getInstrument() != null) {
                ti.setInstrument(resultInv.getInstrument().getFullName());
            }
            ti.setProposal(resultInv.getSummary());
            ArrayList<TPublication> publicationList = new ArrayList<TPublication>();
            List<Publication> pubs = resultInv.getPublications();
            for (Publication pub : pubs) {
                publicationList.add(copyPublicationToTPublication(pub));
            }
            ti.setPublications(publicationList);

            ArrayList<TInvestigator> investigatorList = new ArrayList<TInvestigator>();
            List<InvestigationUser> users = resultInv.getInvestigationUsers();
            for (InvestigationUser user : users) {
                investigatorList.add(copyInvestigatorToTInvestigator(user));
            }
            Collections.sort(investigatorList);
            ti.setInvestigators(investigatorList);

            ArrayList<TShift> shiftList = new ArrayList<TShift>();
            List<Shift> shifts = resultInv.getShifts();
            for (Shift shift : shifts) {
                shiftList.add(copyShiftToTShift(shift));
            }
            ti.setShifts(shiftList);

            ArrayList<TParameter> parameterList = new ArrayList<TParameter>();
            List<InvestigationParameter> params = resultInv.getParameters();
            for (InvestigationParameter param : params) {
                parameterList.add(copyParameterToTParameter(param));
            }
            ti.setParameters(parameterList);
        } catch (IcatException_Exception ex) {
            // TODO check type
            throw new AuthenticationException(ex.getMessage());
        }
        return ti;
    }

    private TParameter copyParameterToTParameter(InvestigationParameter param) {
        TParameter tp = new TParameter();
        tp.setName(param.getType().getName());
        if (param.getType().getValueType() == ParameterValueType.NUMERIC) {
            tp.setValue(param.getNumericValue().toString());
        } else if (param.getType().getValueType() == ParameterValueType.STRING) {
            tp.setValue(param.getStringValue());
        } else if (param.getType().getValueType() == ParameterValueType.DATE_AND_TIME) {
            tp.setValue(param.getDateTimeValue().toString());
        }
        tp.setUnits(param.getType().getUnits());
        return tp;
    }

    @Override
    public ArrayList<TInvestigation> searchByAdvancedPagination(String sessionId, TAdvancedSearchDetails details,
            int start, int end) throws TopcatException {
        ArrayList<TInvestigation> investigationList = new ArrayList<TInvestigation>();
        String query = getAdvancedQuery(sessionId, details);
        List<Object> resultInv = null;
        try {
            resultInv = service.search(sessionId, start + ", " + end + query);
        } catch (IcatException_Exception e) {
            convertToTopcatException(e);
        }
        for (Object inv : resultInv) {
            investigationList.add(copyInvestigationToTInvestigation(serverName, (Investigation) inv));
        }

        Collections.sort(investigationList);
        return investigationList;
    }

    @Override
    public ArrayList<TDataset> getDatasetsInInvestigation(String sessionId, Long investigationId) {
        ArrayList<TDataset> datasetList = new ArrayList<TDataset>();
        try {
            Investigation resultInv = (Investigation) service.get(sessionId,
                    "Investigation INCLUDE Dataset, DatasetType", investigationId);
            List<Dataset> dList = resultInv.getDatasets();
            for (Dataset dataset : dList) {
                String status;
                if (dataset.isComplete()) {
                    status = "complete";
                } else {
                    status = "in progress";
                }
                datasetList.add(new TDataset(serverName, dataset.getId().toString(), dataset.getName(), dataset
                        .getDescription(), dataset.getType().getName(), status));
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
            System.out.println("ERROR - getDatasetsInInvestigation: " + ex.getMessage());
        }
        return datasetList;
    }

    @Override
    public ArrayList<TDatasetParameter> getParametersInDataset(String sessionId, Long datasetId) {
        ArrayList<TDatasetParameter> result = new ArrayList<TDatasetParameter>();
        try {
            Dataset ds = (Dataset) service.get(sessionId, "Dataset INCLUDE DatasetParameter, ParameterType", datasetId);
            List<DatasetParameter> dsList = ds.getParameters();
            for (DatasetParameter dsParam : dsList) {
                if (dsParam.getType().getValueType() == ParameterValueType.NUMERIC) {
                    result.add(new TDatasetParameter(dsParam.getType().getName(), dsParam.getType().getUnits(), dsParam
                            .getNumericValue().toString()));
                } else if (dsParam.getType().getValueType() == ParameterValueType.STRING) {
                    result.add(new TDatasetParameter(dsParam.getType().getName(), dsParam.getType().getUnits(), dsParam
                            .getStringValue()));
                } else if (dsParam.getType().getValueType() == ParameterValueType.DATE_AND_TIME) {
                    result.add(new TDatasetParameter(dsParam.getType().getName(), dsParam.getType().getUnits(), dsParam
                            .getDateTimeValue().toString()));
                }
            }
        } catch (IcatException_Exception e) {
            // TODO check type
            System.out.println("ERROR - getParametersInDataset: " + e.getMessage());
        }
        return result;
    }

    @Override
    public String getDatasetName(String sessionId, Long datasetId) {
        try {
            Dataset ds = (Dataset) service.get(sessionId, "Dataset", datasetId);
            return ds.getName();
        } catch (IcatException_Exception e) {
            // TODO check type
            System.out.println("ERROR - getParametersInDataset: " + e.getMessage());
        }
        return "";
    }

    @Override
    public ArrayList<TDatafile> getDatafilesInDataset(String sessionId, Long datasetId) {
        ArrayList<TDatafile> datafileList = new ArrayList<TDatafile>();
        try {
            Dataset resultInv = (Dataset) service.get(sessionId, "Dataset INCLUDE Datafile, DatafileFormat", datasetId);
            List<Datafile> dList = resultInv.getDatafiles();
            for (Datafile datafile : dList) {
                datafileList.add(copyDatafileToTDatafile(serverName, datafile));
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
            System.out.println("ERROR - getDatafilesInDataset: " + ex.getMessage());
        }
        return datafileList;
    }

    @Override
    public ArrayList<TDatafileParameter> getParametersInDatafile(String sessionId, Long datafileId) {
        ArrayList<TDatafileParameter> result = new ArrayList<TDatafileParameter>();
        try {
            Datafile df = (Datafile) service.get(sessionId, "Datafile INCLUDE DatafileParameter, ParameterType",
                    datafileId);
            List<DatafileParameter> dfList = df.getParameters();
            for (DatafileParameter dfParam : dfList) {
                if (dfParam.getType().getValueType() == ParameterValueType.NUMERIC) {
                    result.add(new TDatafileParameter(dfParam.getType().getName(), dfParam.getType().getUnits(),
                            dfParam.getNumericValue().toString()));
                } else if (dfParam.getType().getValueType() == ParameterValueType.STRING) {
                    result.add(new TDatafileParameter(dfParam.getType().getName(), dfParam.getType().getUnits(),
                            dfParam.getStringValue()));
                } else if (dfParam.getType().getValueType() == ParameterValueType.DATE_AND_TIME) {
                    result.add(new TDatafileParameter(dfParam.getType().getName(), dfParam.getType().getUnits(),
                            dfParam.getDateTimeValue().toString()));
                }
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
        }
        return result;
    }

    @Override
    public String downloadDatafiles(String sessionId, ArrayList<Long> datafileIds) {
        String result = "";
        // try {
        // result = service.downloadDatafiles(sessionId, datafileIds);
        // } catch (IcatException_Exception ex) {
        // // TODO check type
        // }
        return result;
    }

    @Override
    public String downloadDataset(String sessionId, Long datasetId) {
        String result = "";
        // try {
        // result = service.downloadDataset(sessionId, datasetId);
        // } catch (IcatException_Exception ex) {
        // // TODO check type
        // }
        return result;
    }

    @Override
    public ArrayList<String> getKeywordsForUser(String sessionId) {
        return searchList(sessionId, "DISTINCT Keyword.name");
    }

    @Override
    public ArrayList<String> getKeywordsInInvestigation(String sessionId, Long investigationId) {
        ArrayList<String> keywords = new ArrayList<String>();
        try {
            Investigation inv = (Investigation) service
                    .get(sessionId, "Investigation INCLUDE Keyword", investigationId);
            List<Keyword> resultKeywords = inv.getKeywords();
            for (Keyword key : resultKeywords) {
                keywords.add(key.getName());
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
        }
        return keywords;
    }

    @Override
    public ArrayList<TInvestigation> searchByKeywords(String sessionId, ArrayList<String> keywords) {
        // call the search using keyword method
        List<Object> resultInvestigations = null;
        ArrayList<TInvestigation> returnTInvestigations = new ArrayList<TInvestigation>();
        String query = "DISTINCT Investigation <-> Keyword[name IN " + getIN(keywords) + "]";
        try {
            resultInvestigations = service.search(sessionId, query);
            for (Object inv : resultInvestigations) {
                returnTInvestigations.add(copyInvestigationToTInvestigation(serverName, (Investigation) inv));
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
        }
        Collections.sort(returnTInvestigations);
        return returnTInvestigations;
    }

    @Override
    public ArrayList<TDatafile> searchDatafilesByRunNumber(String sessionId, ArrayList<String> instruments,
            float startRunNumber, float endRunNumber) {
        List<Object> resultDatafiles = null;
        ArrayList<TDatafile> returnTDatafiles = new ArrayList<TDatafile>();
        try {
            resultDatafiles = service.search(sessionId,
                    "DISTINCT Datafile  INCLUDE DatafileFormat <-> Dataset <-> Investigation <-> Instrument[name IN "
                            + getIN(instruments)
                            + "] <-> DatafileParameter[type.name='run_number' AND numericValue BETWEEN "
                            + startRunNumber + " AND " + endRunNumber + "]");
        } catch (IcatException_Exception ex) {
            // TODO check type
            System.out.println("ERROR - searchByRunNumber: " + ex.getMessage());
        }
        for (Object datafile : resultDatafiles) {
            returnTDatafiles.add(copyDatafileToTDatafile(serverName, (Datafile) datafile));
        }
        return returnTDatafiles;
    }

    @Override
    public ArrayList<String> getKeywordsForUserWithStartMax(String sessionId, String partialKey, int numberOfKeywords) {

        ArrayList<String> resultKeywords = new ArrayList<String>();
        try {
            List<Object> results = service.search(sessionId, "0," + numberOfKeywords + "DISTINCT Keyword.name LIKE "
                    + partialKey + "%");
            for (Object keyword : results) {
                resultKeywords.add((String) keyword);
            }
        } catch (IcatException_Exception ex) {
            // TODO check type
        }
        return resultKeywords;
    }

    @Override
    public ArrayList<TDatafile> searchDatafilesByParameter(String sessionId, TAdvancedSearchDetails details)
            throws TopcatException {
        ArrayList<TDatafile> datafileList = new ArrayList<TDatafile>();
        String query = getParameterQuery(sessionId, details, "Datafile");
        List<Object> resultDf = null;
        try {
            resultDf = service.search(sessionId, query);
        } catch (IcatException_Exception e) {
            convertToTopcatException(e);
        }
        for (Object df : resultDf) {
            datafileList.add(copyDatafileToTDatafile(serverName, (Datafile) df));
        }
        return datafileList;
    }

    @Override
    public ArrayList<String> getParameterNames(String sessionId) throws TopcatException {
        ArrayList<String> names = searchList(sessionId, "DISTINCT ParameterType.name");
        Collections.sort(names);
        return names;
    }

    @Override
    public ArrayList<String> getParameterUnits(String sessionId, String name) throws TopcatException {
        ArrayList<String> units = searchList(sessionId, "DISTINCT ParameterType.units [name = '" + name + "']");
        Collections.sort(units);
        return units;
    }

    @Override
    public ArrayList<String> getParameterTypes(String sessionId, String name, String units) throws TopcatException {
        ArrayList<String> unitsList = new ArrayList<String>();
        List<ParameterValueType> results = getParameterTypesFormService(sessionId, name, units);
        for (ParameterValueType result : results) {
            unitsList.add(result.toString());
        }
        return unitsList;
    }

    private void convertToTopcatException(IcatException_Exception e) throws TopcatException {
        IcatException ue = e.getFaultInfo();
        System.out.println("ERROR - throwTopcatException: " + ue.getType() + " ~ " + e.getMessage());
        if (ue.getType().equals(IcatExceptionType.BAD_PARAMETER)) {
            throw new TopcatException(e.getMessage(), TopcatExceptionType.BAD_PARAMETER);
        } else if (ue.getType().equals(IcatExceptionType.INSUFFICIENT_PRIVILEGES)) {
            throw new TopcatException(e.getMessage(), TopcatExceptionType.INSUFFICIENT_PRIVILEGES);
        } else if (ue.getType().equals(IcatExceptionType.INTERNAL)) {
            throw new TopcatException(e.getMessage(), TopcatExceptionType.INTERNAL);
        } else if (ue.getType().equals(IcatExceptionType.NO_SUCH_OBJECT_FOUND)) {
            throw new TopcatException(e.getMessage(), TopcatExceptionType.NO_SUCH_OBJECT_FOUND);
        } else if (ue.getType().equals(IcatExceptionType.OBJECT_ALREADY_EXISTS)) {
            throw new TopcatException(e.getMessage(), TopcatExceptionType.OBJECT_ALREADY_EXISTS);
        } else if (ue.getType().equals(IcatExceptionType.SESSION)) {
            throw new TopcatException(e.getMessage(), TopcatExceptionType.SESSION);
        } else if (ue.getType().equals(IcatExceptionType.VALIDATION)) {
            throw new TopcatException(e.getMessage(), TopcatExceptionType.VALIDATION);
        }
    }

    private String getAdvancedQuery(String sessionId, TAdvancedSearchDetails details) throws TopcatException {
        // Parameter - if it is a parameter search then we do not use the other
        // search details
        if (details.getParameterName() != null) {
            return getParameterQuery(sessionId, details, "Investigation");
        }

        StringBuilder query = new StringBuilder(" DISTINCT Investigation");
        boolean addAnd = false;
        boolean queryDataset = false;

        // Dates
        if (details.getStartDate() != null && details.getEndDate() != null) {
            addAnd = true;
            String startDate = getDate(details.getStartDate());
            String endDate = getDate(details.getEndDate());
            query.append(" [((startDate<=" + startDate + " AND endDate>=" + startDate + ") OR (startDate>=" + startDate
                    + " AND endDate<=" + endDate + ") OR (startDate<=" + endDate + " AND endDate>=" + endDate + "))");
        }

        // Proposal Abstract
        if (details.getProposalAbstract() != null) {
            if (addAnd) {
                query.append(" AND");
            } else {
                query.append(" [");
                addAnd = true;
            }
            query.append(" summary='" + details.getProposalAbstract() + "'");
        }

        // Proposal Title
        if (details.getPropostaltitle() != null) {
            if (addAnd) {
                query.append(" AND");
            } else {
                query.append(" [");
                addAnd = true;
            }
            query.append(" title='" + details.getPropostaltitle() + "'");
        }

        if (addAnd) {
            query.append("]");
        }

        // Data File Name
        if (details.getDatafileName() != null) {
            query.append(" <-> Dataset <-> Datafile[name='" + details.getDatafileName() + "']");
            queryDataset = true;
        }

        // Grant Id
        if (details.getGrantId() != null) {
            query.append(" <-> InvestigationParameter [type.name='grant_id' AND stringValue='" + details.getGrantId()
                    + "']");
        }

        // Instrument
        if (details.getInstrumentList().size() > 0) {
            query.append(" <-> Instrument[name IN " + getIN(details.getInstrumentList()) + "]");
        }

        // Investigation Type
        if (details.getInvestigationTypeList().size() > 0) {
            query.append(" <-> InvestigationType[name IN " + getIN(details.getInvestigationTypeList()) + "]");
        }

        // Investigator Name
        if (details.getInvestigatorNameList().size() > 0) {
            query.append(" <-> InvestigationUser <-> User[");
            boolean firstLoop = true;
            for (String name : details.getInvestigatorNameList()) {
                if (firstLoop) {
                    firstLoop = false;
                } else {
                    query.append(" OR ");
                }
                query.append("name LIKE '%" + name + "%'");
            }
            query.append("]");
        }

        // Keywords
        if (details.getKeywords().size() > 0
                && !(details.getKeywords().size() == 1 && details.getKeywords().get(0).length() == 0)) {
            query.append(" <-> Keyword[name IN " + getIN(details.getKeywords()) + "]");
        }

        // Run Numbers
        if (details.getRbNumberStart() != null && details.getRbNumberEnd() != null) {
            query.append(" <-> Dataset <-> Datafile <-> DatafileParameter[type.name='run_number' AND numericValue BETWEEN "
                    + details.getRbNumberStart() + " AND " + details.getRbNumberEnd() + "]");
            queryDataset = true;
        }

        // Sample
        // TODO We cannot use dataset and sample in the same query
        if (details.getSample() != null && !queryDataset) {
            query.append(" <-> Sample[name='" + details.getSample() + "']");
        }
        return query.toString();
    }

    /**
     * Construct the query string to search for parameter(s).
     * 
     * @param sessionId
     * @param details
     * @param name
     *            'Investigation', 'Dataset' or 'Datafile'
     * @return a query string
     * @throws TopcatException
     */
    private String getParameterQuery(String sessionId, TAdvancedSearchDetails details, String name)
            throws TopcatException {
        List<ParameterValueType> types = getParameterTypesFormService(sessionId, details.getParameterName(),
                details.getParameterUnits());
        StringBuilder query = new StringBuilder(" DISTINCT " + name);
        if (details.getParameterUnits().equals(TConstants.ALL_UNITS)) {
            // Search for all possible units for the parameter type
            query.append(" <-> " + name + "Parameter [");
            boolean first = true;
            for (ParameterValueType type : types) {
                if (!first) {
                    query.append(" OR ");
                }
                if (details.getParameterValueMax() == null || details.getParameterValueMax().isEmpty()) {
                    // Search for a single value
                    if (type == ParameterValueType.DATE_AND_TIME) {
                        query.append("(type.name='" + details.getParameterName() + "' AND dateTimeValue="
                                + details.getParameterValue() + ")");
                        first = false;
                    } else if (type == ParameterValueType.NUMERIC && isNumeric(details.getParameterValue())) {
                        // As this is checking all parameters only check numeric
                        // types if values are numeric
                        query.append("(type.name='" + details.getParameterName() + "' AND numericValue="
                                + details.getParameterValue() + ")");
                        first = false;
                    } else if (type == ParameterValueType.STRING) {
                        query.append("(type.name='" + details.getParameterName() + "' AND stringValue='"
                                + details.getParameterValue() + "')");
                        first = false;
                    }
                } else {
                    // Search for a range of single values
                    if (type == ParameterValueType.DATE_AND_TIME) {
                        query.append("(type.name='" + details.getParameterName() + "' AND dateTimeValue BETWEEN "
                                + details.getParameterValue() + " AND " + details.getParameterValueMax() + ")");
                        first = false;
                    } else if (type == ParameterValueType.NUMERIC && isNumeric(details.getParameterValue())
                            & isNumeric(details.getParameterValueMax())) {
                        // As this is checking all parameters only check numeric
                        // types if values are numeric
                        query.append("(type.name='" + details.getParameterName() + "' AND numericValue BETWEEN "
                                + details.getParameterValue() + " AND " + details.getParameterValueMax() + ")");
                        first = false;
                    } else if (type == ParameterValueType.STRING) {
                        query.append("(type.name='" + details.getParameterName() + "' AND stringValue BETWEEN '"
                                + details.getParameterValue() + "' AND '" + details.getParameterValueMax() + "')");
                        first = false;
                    }
                }
            }
            query.append("]");
        } else {
            // Search for specific parameter type and units
            query.append(" <-> " + name + "Parameter [type.name='" + details.getParameterName() + "' AND type.units='"
                    + details.getParameterUnits() + "' AND ");
            if (details.getParameterValueMax() == null || details.getParameterValueMax().isEmpty()) {
                // Search for a single value
                if (types.get(0) == ParameterValueType.DATE_AND_TIME) {
                    query.append("dateTimeValue=" + details.getParameterValue() + "]");
                } else if (types.get(0) == ParameterValueType.NUMERIC) {
                    query.append("numericValue=" + details.getParameterValue() + "]");
                } else if (types.get(0) == ParameterValueType.STRING) {
                    query.append("stringValue='" + details.getParameterValue() + "']");
                }
            } else {
                // Search for a range of values
                if (types.get(0) == ParameterValueType.DATE_AND_TIME) {
                    query.append("dateTimeValue BETWEEN " + details.getParameterValue() + " AND "
                            + details.getParameterValueMax() + "]");
                } else if (types.get(0) == ParameterValueType.NUMERIC) {
                    query.append("numericValue BETWEEN " + details.getParameterValue() + " AND "
                            + details.getParameterValueMax() + "]");
                } else if (types.get(0) == ParameterValueType.STRING) {
                    query.append("stringValue BETWEEN '" + details.getParameterValue() + "' AND '"
                            + details.getParameterValueMax() + "']");
                }
            }
        }
        return query.toString();
    }

    private boolean isNumeric(String value) {
        try {
            new Double(value);
        } catch (NumberFormatException e) {
            return false;
        }
        return true;
    }

    private List<ParameterValueType> getParameterTypesFormService(String sessionId, String name, String units)
            throws TopcatException {
        String query;
        List<ParameterValueType> types = new ArrayList<ParameterValueType>();
        if (units.equals(TConstants.ALL_UNITS)) {
            query = "DISTINCT ParameterType.valueType [name='" + name + "']";
        } else {
            query = "DISTINCT ParameterType.valueType [name='" + name + "' and units='" + units + "']";
        }
        try {
            List<Object> results = service.search(sessionId, query);
            for (Object result : results) {
                types.add((ParameterValueType) result);
            }
        } catch (IcatException_Exception e) {
            IcatException ue = e.getFaultInfo();
            if (!ue.getType().equals(IcatExceptionType.BAD_PARAMETER)) {
                convertToTopcatException(e);
            } else {
                throw new TopcatException("Parameter name/units not found", TopcatExceptionType.BAD_PARAMETER);
            }
        }
        if (types.size() == 0) {
            // Parameter not found
            throw new TopcatException("Parameter name/units not found", TopcatExceptionType.BAD_PARAMETER);
        }
        return types;
    }

    private String getDate(Date date) {
        StringBuilder retDate = new StringBuilder();
        retDate.append("{ts ");
        SimpleDateFormat formater = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        retDate.append(formater.format(date));
        retDate.append("}");
        return retDate.toString();
    }

    private TInvestigation copyInvestigationToTInvestigation(String serverName, Investigation inv) {
        String id = inv.getId().toString();
        Date invStartDate = null;
        Date invEndDate = null;

        if (inv.getStartDate() != null) {
            invStartDate = inv.getStartDate().toGregorianCalendar().getTime();
        }
        if (inv.getEndDate() != null) {
            invEndDate = inv.getEndDate().toGregorianCalendar().getTime();
        }
        return new TInvestigation(id, inv.getName(), serverName, inv.getTitle(), invStartDate, invEndDate,
                inv.getVisitId());
    }

    private TDatafile copyDatafileToTDatafile(String serverName, Datafile datafile) {
        String format = "";
        String formatVersion = "";
        String formatType = "";
        Date createDate = null;
        if (datafile.getDatafileFormat() != null) {
            format = datafile.getDatafileFormat().getName();
            formatVersion = datafile.getDatafileFormat().getVersion();
            formatType = datafile.getDatafileFormat().getType();
        }
        if (datafile.getDatafileCreateTime() != null) {
            createDate = datafile.getDatafileCreateTime().toGregorianCalendar().getTime();
        }
        return new TDatafile(serverName, datafile.getId().toString(), datafile.getName(), datafile.getFileSize(),
                format, formatVersion, formatType, createDate, datafile.getLocation());
    }

    private TPublication copyPublicationToTPublication(Publication pub) {
        return new TPublication(pub.getFullReference(), pub.getId(), pub.getRepository(), pub.getRepositoryId(),
                pub.getUrl());
    }

    private TInvestigator copyInvestigatorToTInvestigator(InvestigationUser investigator) {
        return new TInvestigator("", "", investigator.getUser().getFullName(), investigator.getRole());
    }

    private TShift copyShiftToTShift(Shift shift) {
        return new TShift(shift.getComment(), shift.getStartDate().toGregorianCalendar().getTime(), shift.getEndDate()
                .toGregorianCalendar().getTime());
    }

    private ArrayList<String> searchList(String sessionId, String query) {
        ArrayList<String> returnList = new ArrayList<String>();
        try {
            List<Object> results = service.search(sessionId, query);
            for (Object item : results) {
                returnList.add((String) item);
            }
        } catch (java.lang.NullPointerException ex) {
        } catch (IcatException_Exception ex) {
            // TODO check type
        }
        return returnList;
    }

    private String getIN(List<String> ele) {
        final StringBuilder infield = new StringBuilder("(");
        for (final String t : ele) {
            if (infield.length() != 1) {
                infield.append(',');
            }
            infield.append('\'').append(t).append('\'');
        }
        infield.append(')');
        return infield.toString();
    }
}
