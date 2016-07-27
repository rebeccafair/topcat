package org.icatproject.topcat.repository;

import java.util.ArrayList;
import java.util.Date;
import java.text.SimpleDateFormat;
import java.text.DateFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.text.ParseException;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

import javax.ejb.EJB;
import javax.ejb.LocalBean;
import javax.ejb.Singleton;
import javax.ejb.Stateless;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import javax.persistence.TypedQuery;

import org.icatproject.topcat.domain.Download;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Stateless
@LocalBean
public class DownloadRepository {
	@PersistenceContext(unitName = "topcat")
	EntityManager em;

	private static final Logger logger = LoggerFactory.getLogger(DownloadRepository.class);

	public List<Download> getDownloads(Map<String, Object> params) throws ParseException {
		List<Download> downloads = new ArrayList<Download>();

		String queryOffset = (String) params.get("queryOffset");
		String userName = (String) params.get("userName");
		Integer limitPageSize = null;
		Integer limitOffset = null;

		if (queryOffset != null) {
			queryOffset = queryOffset.replaceAll("(?i)^\\s*WHERE\\s+", "");
			Pattern pattern = Pattern.compile("(?i)^(.*)LIMIT\\s+(\\d)+,\\s*(\\d+)\\s*$");
			Matcher matches = pattern.matcher(queryOffset);
			if (matches.find()) {
				queryOffset = matches.group(1);
				limitOffset = Integer.parseInt(matches.group(2));
				limitPageSize = Integer.parseInt(matches.group(3));
			}
		}

		if (em != null) {
			StringBuilder sb = new StringBuilder();
			sb.append("SELECT download FROM Download download ");

			if (userName != null && queryOffset != null) {
				sb.append("WHERE download.userName = :userName AND " + queryOffset + " ");
			} else if (userName != null) {
				sb.append("WHERE download.userName = :userName ");
			} else if (queryOffset != null) {
				sb.append("WHERE " + queryOffset + " ");
			}

			logger.debug(sb.toString());

			TypedQuery<Download> query = em.createQuery(sb.toString(), Download.class);

			if (userName != null) {
				query.setParameter("userName", userName);
			}

			if (limitOffset != null) {
				query.setFirstResult(limitOffset);
				query.setMaxResults(limitPageSize);
			}

			logger.debug(query.toString());

			downloads = query.getResultList();

			if (downloads != null) {
				return downloads;
			}

		}

		return downloads;
	}

	public Download getDownload(Long id) {
		return em.find(Download.class, id);
	}

	public Download save(Download store) {
		em.persist(store);
		em.flush();

		return store;
	}

}
