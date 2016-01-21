
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

import java.text.ParseException;


import javax.ejb.EJB;
import javax.ejb.Singleton;
import javax.ejb.Schedule;
import javax.ejb.Stateless;

import javax.persistence.Persistence;
import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
import javax.persistence.TypedQuery;
import javax.persistence.PersistenceContext;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.icatproject.topcat.domain.Download;
import org.icatproject.topcat.repository.DownloadRepository;

@Singleton
public class Watchdog {
	private static final Logger logger = LoggerFactory.getLogger(Watchdog.class);

	@Schedule(hour="*", minute="*")
	private void poll(){
		logger.info("Task.run");
		EntityManager em = Persistence.createEntityManagerFactory("topcatv2").createEntityManager();
		TypedQuery<Download> query = em.createQuery("select Download d from Download where d.status = 'RESTORING'", Download.class);
		List<Download> downloads = query.getResultList();
		logger.info("RESTORING: " + downloads.size());
	}


}